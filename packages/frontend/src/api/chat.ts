import { http } from './http'
import FallbackUploadWorker from '@/workers/fallback-upload.worker.js?worker'
import type {
  PaginationOptions,
  SearchOptions,
  SearchResponse,
  PaginatedMessages,
  StreamMessageParams,
  StreamRequestOptions,
  ModelInfo,
  ServerConversation,
} from '../types'

/**
 * 会话 API
 */
class ConversationAPI {
  async getConversations(): Promise<ServerConversation[]> {
    return http.request('/conversations') as Promise<ServerConversation[]>
  }

  async getConversation(id: string): Promise<unknown> {
    return http.request(`/conversations/${id}`)
  }

  async getConversationInfo(id: string): Promise<ServerConversation | null> {
    return http.request(`/conversations/${id}/info`) as Promise<ServerConversation | null>
  }

  async createConversation(title?: string): Promise<unknown> {
    return http.request('/conversations', {
      method: 'POST',
      body: { title },
    })
  }

  async deleteConversation(id: string): Promise<unknown> {
    return http.request(`/conversations/${id}`, { method: 'DELETE' })
  }

  async updateTitle(id: string, title: string): Promise<unknown> {
    return http.request(`/conversations/${id}`, {
      method: 'PUT',
      body: { title },
    })
  }

  /**
   * 分页获取会话消息
   */
  async getMessagesPaginated(id: string, options: PaginationOptions = {}): Promise<PaginatedMessages> {
    const params = new URLSearchParams()
    if (options.limit) params.set('limit', String(options.limit))
    if (options.before) params.set('before', options.before)
    if (options.after) params.set('after', options.after)
    const qs = params.toString()
    return http.request(`/conversations/${id}/messages${qs ? '?' + qs : ''}`) as Promise<PaginatedMessages>
  }

  /**
   * 全文搜索消息
   */
  async searchMessages(keyword: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: keyword })
    if (options.limit) params.set('limit', String(options.limit))
    if (options.offset) params.set('offset', String(options.offset))
    return http.request(`/conversations/search?${params.toString()}`) as Promise<SearchResponse>
  }
}

/**
 * 聊天 API 服务
 */
class ChatAPI {
  auth: typeof http
  conversations: ConversationAPI
  conversationId: string | null
  selectedModel: string | null

  constructor() {
    this.auth = http
    this.conversations = new ConversationAPI()
    this.conversationId = null
    this.selectedModel = null
  }

  /**
   * 获取可用模型列表
   */
  async getModels(): Promise<ModelInfo[]> {
    return http.request('/chat/models', { auth: false }) as Promise<ModelInfo[]>
  }

  /**
   * 设置当前使用的模型
   */
  setModel(modelId: string): void {
    this.selectedModel = modelId
  }

  /**
   * 流式发送消息（支持断线重连 + 消息幂等）
   */
  async streamMessage({ message, images = [], onChunk, onComplete, onError, onConversationCreated }: StreamMessageParams): Promise<void> {
    const originalFiles = images
      .filter(img => img.originalFile)
      .map(img => img.originalFile!)

    const MAX_RECONNECT = 3
    const RECONNECT_DELAY = 1000

    let streamId: string | null = null
    let lastEventId: string | null = null
    const processedSeqs = new Set<number>()
    let reconnectCount = 0
    let completed = false

    const buildStreamOptions = (): StreamRequestOptions => {
      if (images.length > 0) {
        const formData = new FormData()
        formData.append('message', message || '')
        if (this.conversationId) {
          formData.append('conversationId', this.conversationId)
        }
        if (this.selectedModel) {
          formData.append('model', this.selectedModel)
        }
        for (const img of images) {
          formData.append('images', img.file)
        }
        return { formData }
      }
      const body: Record<string, unknown> = { message, conversationId: this.conversationId }
      if (this.selectedModel) {
        body.model = this.selectedModel
      }
      return { body }
    }

    const processStream = async (): Promise<void> => {
      try {
        const streamOptions = buildStreamOptions()
        // 断线重连时带上 Last-Event-ID
        if (lastEventId) {
          streamOptions.headers = { 'Last-Event-ID': lastEventId }
        }

        const response = await http.requestStream('/chat/stream', streamOptions)

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const event of events) {
            let eventId: string | null = null
            let eventData: string | null = null

            for (const line of event.split('\n')) {
              if (line.startsWith('id: ')) {
                eventId = line.slice(4)
              } else if (line.startsWith('data: ')) {
                eventData = line.slice(6)
              }
            }

            if (!eventData) continue

            if (eventId) {
              lastEventId = eventId

              const seq = parseInt(eventId.split(':')[1], 10)
              if (processedSeqs.has(seq)) continue
              processedSeqs.add(seq)
            }

            try {
              const data = JSON.parse(eventData) as Record<string, unknown>

              if (data.type === 'stream-id') {
                streamId = data.streamId as string
              } else if (data.type === 'conversation') {
                this.conversationId = data.conversationId as string
                onConversationCreated?.(data.conversationId as string)
              } else if (data.type === 'chunk') {
                onChunk?.(data.content as string)
              } else if (data.type === 'done') {
                completed = true
                onComplete?.(data.content as string)
                if (data.imageIds && (data.imageIds as string[]).length > 0 && originalFiles.length > 0) {
                  this._uploadFallbacks(data.imageIds as string[], originalFiles)
                }
              } else if (data.type === 'error') {
                completed = true
                onError?.(new Error(data.message as string))
              }
            } catch (e) {
              console.warn('Parse SSE data error:', e)
            }
          }
        }
      } catch (error) {
        if (completed) return

        if (reconnectCount < MAX_RECONNECT && lastEventId) {
          reconnectCount++
          console.info(`SSE 断线，第 ${reconnectCount} 次重连...`)
          await new Promise(r => setTimeout(r, RECONNECT_DELAY * reconnectCount))
          return processStream()
        }

        console.error('Stream message error:', error)
        onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    }

    await processStream()
  }

  /**
   * 通过 Web Worker 后台压缩 jpeg 兜底图 + 上传
   */
  _uploadFallbacks(imageIds: string[], originalFiles: (File | Blob)[]): void {
    try {
      const worker = new FallbackUploadWorker()
      worker.postMessage({
        imageIds,
        originalFiles,
        token: http.token,
        apiBase: '/api',
      })
      worker.addEventListener('message', (e: MessageEvent) => {
        if (!e.data.success) {
          console.warn('Worker upload fallbacks failed:', e.data.error)
        }
        worker.terminate()
      })
      worker.addEventListener('error', (e: ErrorEvent) => {
        console.warn('Worker error:', e.message)
        worker.terminate()
      })
    } catch (error) {
      console.warn('Upload fallbacks error:', error)
    }
  }

  /**
   * 清除会话历史
   */
  async clearHistory(): Promise<void> {
    if (this.conversationId) {
      try {
        await http.request(`/chat/history/${this.conversationId}`, { method: 'DELETE' })
      } catch (error) {
        console.error('Clear history error:', error)
      }
    }
    this.conversationId = null
  }

  /**
   * 设置当前会话
   */
  setConversation(id: string): void {
    this.conversationId = id
  }

  /**
   * 开启新会话
   */
  startNewConversation(): void {
    this.conversationId = null
  }
}

export const chatAPI = new ChatAPI()
