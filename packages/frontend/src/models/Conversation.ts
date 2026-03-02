import type { ServerConversation } from '../types'

/**
 * 会话模型
 */
export class Conversation {
  id: string
  userId: string
  title: string
  lastMessage: string
  createdAt: string
  updatedAt: string

  constructor({ id, userId = '', title = '新对话', lastMessage = '', createdAt = '', updatedAt = '' }: {
    id: string
    userId?: string
    title?: string
    lastMessage?: string
    createdAt?: string
    updatedAt?: string
  }) {
    this.id = id
    this.userId = userId
    this.title = title
    this.lastMessage = lastMessage
    this.createdAt = createdAt
    this.updatedAt = updatedAt
  }

  /**
   * 从后端会话列表数据创建 Conversation 实例
   */
  static fromServer(serverConv: ServerConversation): Conversation {
    return new Conversation({
      id: serverConv.id,
      userId: serverConv.user_id || '',
      title: serverConv.title || '新对话',
      lastMessage: serverConv.last_message || '',
      createdAt: serverConv.created_at || '',
      updatedAt: serverConv.updated_at || '',
    })
  }

  /**
   * 判断缓存是否仍然有效（与服务端 updatedAt 比较）
   */
  isCacheValid(serverUpdatedAt: string): boolean {
    return !!this.updatedAt && this.updatedAt === serverUpdatedAt
  }
}
