// ─── API 层类型 ──────────────────────────────────────────

export interface UserInfo {
  id: string
  username: string
  nickname: string | null
  avatar: string | null
}

export interface AuthTokens {
  token: string
  refreshToken?: string
  user?: UserInfo
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

export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  error?: string
}

// ─── 模型相关 ────────────────────────────────────────────

export interface ModelInfo {
  id: string
  name: string
  provider: string
  icon: string
  description: string
  free: boolean
  supportVision: boolean
}

// ─── 消息 & 会话 ────────────────────────────────────────

export interface ServerConversation {
  id: string
  user_id?: string
  title?: string
  last_message?: string
  created_at?: string
  updated_at?: string
}

export interface ServerMessage {
  id: string
  content: string
  created_at: string
  role: 'user' | 'assistant'
  images?: ServerImage[]
}

export interface ServerImage {
  id?: string
  url?: string
  fallback_url?: string
  storage_type?: string
  original_name?: string
  mime_type?: string
}

export interface PaginationInfo {
  hasMoreBefore: boolean
  hasMoreAfter: boolean
}

export interface PaginatedMessages {
  messages: ServerMessage[]
  pagination: PaginationInfo
}

export interface PaginationOptions {
  limit?: number
  before?: string
  after?: string
}

export interface SearchOptions {
  limit?: number
  offset?: number
}

export interface SearchResult {
  id: string
  conversationId: string
  conversationTitle?: string
  content: string
  role: 'user' | 'assistant'
  createdAt: string
}

export interface SearchResponse {
  messages: SearchResult[]
  total: number
  limit: number
  offset: number
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
