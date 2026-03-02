import type { Response } from 'express'
import { aiService, AVAILABLE_MODELS } from '../services/ai'
import { messageService } from '../services/message'
import { storageService } from '../services/storage'
import { v4 as uuidv4 } from 'uuid'
import type { AuthRequest, ImageData, StreamBufferEntry } from '../types'

// ─── SSE Stream Buffer（断线重连用）────────────────────────

const STREAM_BUFFER_TTL = 5 * 60 * 1000 // 5 分钟过期

/**
 * 每个活跃的流式会话缓冲区
 */
const streamBuffers = new Map<string, StreamBufferEntry>()

// 定期清理过期的缓冲区
setInterval(() => {
  const now = Date.now()
  for (const [id, buf] of streamBuffers) {
    if (now - buf.createdAt > STREAM_BUFFER_TTL) {
      streamBuffers.delete(id)
    }
  }
}, 60_000)

/**
 * 统一处理图片：同时兼容 multipart 上传和 JSON base64 两种方式
 */
function extractImages(req: AuthRequest): { imageDataList: ImageData[]; base64Images: string[] } {
  const imageDataList: ImageData[] = []
  const base64Images: string[] = []

  const files = req.files as Record<string, Express.Multer.File[]> | undefined
  const mainFiles = files?.images || []

  if (mainFiles.length > 0) {
    for (const file of mainFiles) {
      imageDataList.push({
        data: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      })
      const base64 = file.buffer.toString('base64')
      base64Images.push(`data:${file.mimetype};base64,${base64}`)
    }
    return { imageDataList, base64Images }
  }

  const bodyImages = req.body?.images
  if (Array.isArray(bodyImages) && bodyImages.length > 0) {
    for (const dataUrl of bodyImages) {
      if (typeof dataUrl !== 'string') continue

      base64Images.push(dataUrl)

      const mimeMatch = dataUrl.match(/^data:(image\/[^;]+);base64,/)
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
      const extMap: Record<string, string> = { 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif' }
      const ext = extMap[mimeType] || '.jpg'
      imageDataList.push({
        data: dataUrl,
        originalName: `image${ext}`,
        mimeType,
      })
    }
  }

  return { imageDataList, base64Images }
}

/**
 * 流式聊天（SSE）
 */
export async function streamChat(req: AuthRequest, res: Response): Promise<void> {
  const { message, conversationId, model } = req.body
  const userId = req.user?.userId
  const { imageDataList, base64Images } = extractImages(req)
  const lastEventId = req.headers['last-event-id'] as string | undefined

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  if (lastEventId) {
    const [streamId, seqStr] = lastEventId.split(':')
    const lastSeq = parseInt(seqStr, 10) || 0
    const buffer = streamBuffers.get(streamId)

    if (buffer) {
      const missedEvents = buffer.events.filter(e => {
        const eSeq = parseInt(e.id.split(':')[1], 10)
        return eSeq > lastSeq
      })
      for (const event of missedEvents) {
        res.write(`id: ${event.id}\ndata: ${event.data}\n\n`)
      }
      res.end()
      return
    }
  }

  const streamId = uuidv4()
  const buffer: StreamBufferEntry = { events: [], createdAt: Date.now(), completed: false }
  streamBuffers.set(streamId, buffer)
  let seq = 0

  function writeEvent(data: Record<string, unknown>): void {
    const eventId = `${streamId}:${seq++}`
    const jsonStr = JSON.stringify(data)
    buffer.events.push({ id: eventId, data: jsonStr })
    res.write(`id: ${eventId}\ndata: ${jsonStr}\n\n`)
  }

  let dbConversationId = conversationId

  try {
    let savedImageIds: string[] = []

    if (userId) {
      if (!dbConversationId) {
        const conv = await messageService.createConversation(userId, (message || '').slice(0, 50) || '新对话')
        dbConversationId = conv.id
        writeEvent({ type: 'conversation', conversationId: dbConversationId })
      }

      const savedMsg = await messageService.saveUserMessage(dbConversationId, message, imageDataList)
      savedImageIds = (savedMsg.images || []).map(img => img.id)
    }

    writeEvent({ type: 'stream-id', streamId })

    await aiService.streamChat({
      conversationId: dbConversationId || 'anonymous',
      userId: userId || 'anonymous',
      message,
      images: base64Images,
      model,
      onChunk: (chunk) => {
        writeEvent({ type: 'chunk', content: chunk })
      },
      onComplete: async (response) => {
        if (userId && dbConversationId) {
          await messageService.saveAssistantMessage(dbConversationId, response)
        }
        const doneData: Record<string, unknown> = { type: 'done', content: response }
        if (savedImageIds.length > 0) {
          doneData.imageIds = savedImageIds
        }
        writeEvent(doneData)
        buffer.completed = true
        res.end()
      },
    })
  } catch (error) {
    console.error('Stream chat error:', error)
    writeEvent({ type: 'error', message: (error as Error).message })
    buffer.completed = true
    res.end()
  }
}

/**
 * 普通聊天（非流式）
 */
export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  const { message, conversationId, model } = req.body
  const userId = req.user?.userId
  const { imageDataList, base64Images } = extractImages(req)

  try {
    let dbConversationId = conversationId
    let savedImageIds: string[] = []

    if (userId) {
      if (!dbConversationId) {
        const conv = await messageService.createConversation(userId, (message || '').slice(0, 50) || '新对话')
        dbConversationId = conv.id
      }

      const savedMsg = await messageService.saveUserMessage(dbConversationId, message, imageDataList)
      savedImageIds = (savedMsg.images || []).map(img => img.id)
    }

    let fullResponse = ''

    await aiService.streamChat({
      conversationId: dbConversationId || 'anonymous',
      userId: userId || 'anonymous',
      message,
      images: base64Images,
      model,
      onChunk: (chunk) => {
        fullResponse += chunk
      },
      onComplete: async () => {
        if (userId && dbConversationId) {
          await messageService.saveAssistantMessage(dbConversationId, fullResponse)
        }
      },
    })

    const responseData: Record<string, unknown> = {
      content: fullResponse,
      conversationId: dbConversationId,
      timestamp: new Date().toISOString(),
    }
    if (savedImageIds.length > 0) {
      responseData.imageIds = savedImageIds
    }

    res.json({
      success: true,
      data: responseData,
    })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
}

/**
 * 获取可用模型列表
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'

const ICON_CACHE_DIR = join(process.cwd(), '.icon-cache')

const iconCache = new Map<string, string>()

function getIconCachePath(url: string): string {
  const hash = createHash('md5').update(url).digest('hex')
  const ext = url.match(/\.(png|svg|ico|jpg|jpeg|webp)/)?.[1] || 'png'
  return join(ICON_CACHE_DIR, `${hash}.${ext}`)
}

async function fetchIconAsDataUrl(url: string): Promise<string> {
  if (iconCache.has(url)) return iconCache.get(url)!

  if (!existsSync(ICON_CACHE_DIR)) {
    mkdirSync(ICON_CACHE_DIR, { recursive: true })
  }

  const cachePath = getIconCachePath(url)

  if (existsSync(cachePath)) {
    try {
      const buffer = readFileSync(cachePath)
      const ext = cachePath.split('.').pop()!
      const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', ico: 'image/x-icon', webp: 'image/webp' }
      const contentType = mimeMap[ext] || 'image/png'
      const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`
      iconCache.set(url, dataUrl)
      return dataUrl
    } catch {
      // 文件读取失败，走网络重新下载
    }
  }

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/png'

    writeFileSync(cachePath, buffer)

    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`
    iconCache.set(url, dataUrl)
    return dataUrl
  } catch {
    return url
  }
}

export async function getModels(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const uniqueIcons = [...new Set(AVAILABLE_MODELS.map(m => m.icon))]
    await Promise.all(uniqueIcons.map(url => fetchIconAsDataUrl(url)))

    const data = AVAILABLE_MODELS.map(m => ({
      ...m,
      icon: iconCache.get(m.icon) || m.icon,
    }))

    res.json({ success: true, data })
  } catch (error) {
    console.error('getModels error:', (error as Error).message)
    res.json({ success: true, data: AVAILABLE_MODELS })
  }
}

/**
 * 健康检查
 */
export function healthCheck(_req: AuthRequest, res: Response): void {
  res.json({ status: 'ok' })
}

/**
 * 上传兜底图
 */
export async function uploadFallbacks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const imageIds: string[] = JSON.parse(req.body?.imageIds || '[]')
    const files = req.files as Record<string, Express.Multer.File[]> | undefined
    const fallbackFiles = files?.fallbacks || []

    if (imageIds.length === 0 || fallbackFiles.length === 0) {
      res.status(400).json({ success: false, error: '缺少 imageIds 或 fallbacks' })
      return
    }

    const results: Array<{ imageId: string; fallbackUrl: string }> = []
    for (let i = 0; i < imageIds.length; i++) {
      const imageId = imageIds[i]
      const file = fallbackFiles[i]
      if (!file) continue

      const { url } = await storageService.saveImage(
        file.buffer,
        file.originalname || 'fallback.jpg',
        file.mimetype || 'image/jpeg'
      )

      await messageService.updateImageFallback(imageId, url)
      results.push({ imageId, fallbackUrl: url })
    }

    res.json({ success: true, data: results })
  } catch (error) {
    console.error('Upload fallbacks error:', error)
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
}
