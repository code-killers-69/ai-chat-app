import type { ServerMessage, ServerImage } from '../types'

/**
 * 消息图片模型
 */
export class MessageImage {
  id: string
  url: string
  fallbackUrl: string
  imageUrl: string
  storageType: string
  file: File | Blob | null
  originalFile: File | Blob | null

  constructor({ id = '', url = '', fallbackUrl = '', imageUrl = '', storageType = 'local', file = null, originalFile = null }: {
    id?: string
    url?: string
    fallbackUrl?: string
    imageUrl?: string
    storageType?: string
    file?: File | Blob | null
    originalFile?: File | Blob | null
  } = {}) {
    this.id = id
    this.url = url
    this.fallbackUrl = fallbackUrl
    this.imageUrl = imageUrl
    this.storageType = storageType
    this.file = file
    this.originalFile = originalFile
  }

  /**
   * 获取可显示的图片地址（优先 imageUrl，其次 url）
   */
  get displayUrl(): string {
    return this.imageUrl || this.url
  }
}

/**
 * 聊天消息模型
 *
 * 前端角色映射：后端 'user' → 前端 'me'，后端 'assistant' → 前端 'you'
 */
export class Message {
  id: string
  content: string
  time: string
  role: 'me' | 'you'
  images: MessageImage[]
  isStreaming: boolean
  /** 原始 ISO 时间戳，用于缓存回写时保留完整时间信息 */
  createdAt: string

  constructor({ id, content, time, role, images = [], isStreaming = false, createdAt = '' }: {
    id: string
    content: string
    time: string
    role: 'me' | 'you'
    images?: (MessageImage | ServerImage)[]
    isStreaming?: boolean
    createdAt?: string
  }) {
    this.id = id
    this.content = content
    this.time = time
    this.role = role
    this.images = images.map(img => img instanceof MessageImage ? img : new MessageImage(img as Record<string, unknown>))
    this.isStreaming = isStreaming
    this.createdAt = createdAt
  }

  /**
   * 从后端消息数据创建 Message 实例
   */
  static fromServer(serverMsg: ServerMessage): Message {
    return new Message({
      id: serverMsg.id,
      content: serverMsg.content,
      time: Message.formatTime(serverMsg.created_at),
      role: serverMsg.role === 'user' ? 'me' : 'you',
      images: (serverMsg.images || []).map(img => new MessageImage(img as Record<string, unknown>)),
      isStreaming: false,
      createdAt: serverMsg.created_at,
    })
  }

  /**
   * 创建用户发送的消息
   */
  static createUserMessage({ content, images = [] }: { content: string; images?: MessageImage[] }): Message {
    return new Message({
      id: Message.generateId(),
      content,
      time: Message.getNowTime(),
      role: 'me',
      images,
      createdAt: new Date().toISOString(),
    })
  }

  /**
   * 创建 AI 流式响应占位消息
   */
  static createStreamingPlaceholder(): Message {
    return new Message({
      id: Message.generateId(),
      content: '',
      time: Message.getNowTime(),
      role: 'you',
      isStreaming: true,
      createdAt: new Date().toISOString(),
    })
  }

  /**
   * 追加流式内容
   */
  appendContent(chunk: string): void {
    this.content += chunk
  }

  /**
   * 结束流式输出
   */
  finishStreaming(): void {
    this.isStreaming = false
  }

  /**
   * 设置错误内容并结束流式
   */
  setError(errorMessage: string): void {
    this.content = `抱歉，发生错误：${errorMessage}`
    this.isStreaming = false
  }

  // ---- 工具方法 ----

  static _idCounter = 0

  static generateId(): string {
    return `msg_${Date.now()}_${++Message._idCounter}`
  }

  static getNowTime(): string {
    const date = new Date()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  static formatTime(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
}
