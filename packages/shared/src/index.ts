// ─── 通用角色类型 ────────────────────────────────────────

export type MessageRole = 'user' | 'assistant'

// ─── 用户 ────────────────────────────────────────────────

export interface UserInfo {
  id: string
  username: string
  nickname: string | null
  avatar: string | null
}

// ─── 模型 ────────────────────────────────────────────────

export interface ModelInfo {
  id: string
  name: string
  provider: string
  icon: string
  description: string
  free: boolean
  supportVision: boolean
}

// ─── API 响应 ────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  error?: string
}

// ─── 会话 ────────────────────────────────────────────────

export interface ServerConversation {
  id: string
  user_id?: string
  title?: string
  last_message?: string
  created_at?: string
  updated_at?: string
}

// ─── 图片 ────────────────────────────────────────────────

export interface ServerImage {
  id?: string
  url?: string
  fallback_url?: string
  storage_type?: string
  original_name?: string
  mime_type?: string
}

// ─── 消息 ────────────────────────────────────────────────

export interface ServerMessage {
  id: string
  content: string
  created_at: string
  role: MessageRole
  images?: ServerImage[]
}

// ─── 分页 ────────────────────────────────────────────────

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

// ─── 搜索 ────────────────────────────────────────────────

export interface SearchOptions {
  limit?: number
  offset?: number
}

export interface SearchResult {
  id: string
  conversationId: string
  conversationTitle?: string
  content: string
  role: MessageRole
  createdAt: string
}

export interface SearchResponse {
  messages: SearchResult[]
  total: number
  limit: number
  offset: number
}
