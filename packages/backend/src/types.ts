import type { Request } from 'express'
import type { JwtPayload } from 'jsonwebtoken'

// ─── 数据库行类型 ────────────────────────────────────────

export interface UserRow {
  id: string
  username: string
  password: string
  nickname: string | null
  avatar: string | null
  created_at: Date
  updated_at: Date
}

export interface ConversationRow {
  id: string
  user_id: string
  title: string
  created_at: Date
  updated_at: Date
  last_message?: string | null
}

export interface MessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: Date
  images?: ImageRow[] | string | null
}

export interface ImageRow {
  id: string
  message_id: string
  storage_type: 'local' | 'cdn' | 'cos'
  url: string
  fallback_url: string
  original_name: string | null
  mime_type: string | null
  size: number | null
  created_at: Date
}

// ─── 业务类型 ────────────────────────────────────────────

export interface TokenPayload extends JwtPayload {
  userId: string
  username: string
  type: 'access' | 'refresh'
}

export interface AuthRequest extends Request {
  user?: TokenPayload
}

export interface ImageData {
  data: Buffer | string
  originalName: string
  mimeType: string
}

export interface SavedImage {
  id: string
  url: string
  fallbackUrl: string
  storageType: string
}

export interface SaveImageResult {
  url: string
  storageType: string
  size: number
  filename: string
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  icon: string
  description: string
  free: boolean
  supportVision: boolean
}

export interface StreamChatParams {
  conversationId: string
  userId: string
  message: string
  images?: string[]
  model?: string
  onChunk?: (chunk: string) => void
  onComplete?: (response: string) => Promise<void> | void
}

export interface StreamBufferEntry {
  events: Array<{ id: string; data: string }>
  createdAt: number
  completed: boolean
}

export interface UploadState {
  filename: string
  mimeType: string
  totalChunks: number
  receivedChunks: Set<number>
  createdAt: number
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
