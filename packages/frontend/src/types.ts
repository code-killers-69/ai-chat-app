// ─── 前端专用类型（共享类型请从 @chat-app/shared 导入）────

import type { ServerMessage, PaginationInfo } from '@chat-app/shared'

// ─── API 层类型 ──────────────────────────────────────────

export interface AuthTokens {
  token: string
  refreshToken?: string
  user?: import('@chat-app/shared').UserInfo
}

export interface RequestOptions {
  method?: string
  body?: Record<string, unknown>
  auth?: boolean
  retry?: boolean
}

export interface FormDataRequestOptions {
  method?: string
  auth?: boolean
}

export interface StreamRequestOptions {
  method?: string
  body?: Record<string, unknown>
  formData?: FormData
  auth?: boolean
  headers?: Record<string, string>
}

// ─── 流式聊天 ────────────────────────────────────────────

export interface StreamMessageImage {
  file: File | Blob
  imageUrl?: string
  originalFile?: File | Blob | null
}

export interface StreamMessageParams {
  message: string
  images?: StreamMessageImage[]
  onChunk?: (chunk: string) => void
  onComplete?: (content: string) => void
  onError?: (error: Error) => void
  onConversationCreated?: (conversationId: string) => void
}

// ─── 图片压缩 ────────────────────────────────────────────

export interface CompressOptions {
  webpQuality?: number
  maxWidth?: number
  maxHeight?: number
}

export interface CompressResult {
  file: File | Blob
  url: string
  originalFile: File | Blob | null
}

// ─── 分片上传 ────────────────────────────────────────────

export interface ChunkUploadOptions {
  filename?: string
  mimeType?: string
  onProgress?: (progress: ChunkUploadProgress) => void
}

export interface ChunkUploadProgress {
  uploaded: number
  total: number
  percent: number
}

export interface ChunkUploadResult {
  url: string
  size: number
  storageType: string
}

// ─── Markdown ────────────────────────────────────────────

export interface MarkdownBatchItem {
  key: string
  content: string
}

export interface MarkdownBatchResult {
  key: string
  html: string
}

// ─── 消息缓存 ────────────────────────────────────────────

export interface MessagesCacheEntry {
  updatedAt: string
  messages: ServerMessage[]
  pagination: PaginationInfo
}
