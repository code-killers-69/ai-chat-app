import { v4 as uuidv4 } from 'uuid'
import { getPool } from '../config/database'
import { storageService } from './storage'
import type { PaginationOptions, SearchOptions } from '@chat-app/shared'
import type { ImageData, SavedImage, MessageRow, ConversationRow, ImageRow } from '../types'

export const messageService = {
  async createConversation(userId: string, title: string = '新对话') {
    const id = uuidv4()
    await getPool().execute(
      'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)',
      [id, userId, title]
    )
    return { id, userId, title, createdAt: new Date() }
  },

  async getConversations(userId: string) {
    const [rows] = await getPool().execute(
      `SELECT c.*, 
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM conversations c 
       WHERE c.user_id = ? 
       ORDER BY c.updated_at DESC`,
      [userId]
    ) as [ConversationRow[], unknown]
    return rows
  },

  async getConversationInfo(conversationId: string, userId: string) {
    const [rows] = await getPool().execute(
      'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    ) as [ConversationRow[], unknown]
    return rows.length > 0 ? rows[0] : null
  },

  async getConversationWithMessages(conversationId: string, userId: string) {
    const [convRows] = await getPool().execute(
      'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    ) as [ConversationRow[], unknown]

    if (convRows.length === 0) {
      return null
    }

    const [messages] = await getPool().execute(
      `SELECT m.*, 
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', i.id, 'url', i.url, 'fallbackUrl', IFNULL(i.fallback_url, ''), 'storageType', i.storage_type))
         FROM images i WHERE i.message_id = m.id) as images
       FROM messages m 
       WHERE m.conversation_id = ? 
       ORDER BY m.created_at ASC`,
      [conversationId]
    ) as [MessageRow[], unknown]

    return {
      ...convRows[0],
      messages: messages.map((m) => ({
        ...m,
        images: m.images
          ? typeof m.images === 'string'
            ? JSON.parse(m.images)
            : m.images
          : [],
      })),
    }
  },

  async saveUserMessage(conversationId: string, content: string, imageDataList: ImageData[] = []) {
    const messageId = uuidv4()

    await getPool().execute(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)',
      [messageId, conversationId, 'user', content]
    )

    const savedImages: SavedImage[] = []
    for (const imageData of imageDataList) {
      const { url, storageType, size } = await storageService.saveImage(
        imageData.data,
        imageData.originalName || 'image.jpg',
        imageData.mimeType || 'image/jpeg'
      )

      const imageId = uuidv4()
      await getPool().execute(
        'INSERT INTO images (id, message_id, storage_type, url, fallback_url, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [imageId, messageId, storageType, url, '', imageData.originalName, imageData.mimeType, size]
      )

      savedImages.push({ id: imageId, url, fallbackUrl: '', storageType })
    }

    await getPool().execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    )

    return {
      id: messageId,
      role: 'user' as const,
      content,
      images: savedImages,
      createdAt: new Date(),
    }
  },

  async saveAssistantMessage(conversationId: string, content: string) {
    const messageId = uuidv4()

    await getPool().execute(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)',
      [messageId, conversationId, 'assistant', content]
    )

    await getPool().execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    )

    return { id: messageId, role: 'assistant' as const, content, createdAt: new Date() }
  },

  async updateImageFallback(imageId: string, fallbackUrl: string) {
    const [result] = await getPool().execute(
      'UPDATE images SET fallback_url = ? WHERE id = ?',
      [fallbackUrl, imageId]
    ) as [{ affectedRows: number }, unknown]
    return result.affectedRows > 0
  },

  async deleteConversation(conversationId: string, userId: string) {
    const [images] = await getPool().execute(
      `SELECT i.* FROM images i 
       JOIN messages m ON i.message_id = m.id 
       JOIN conversations c ON m.conversation_id = c.id 
       WHERE c.id = ? AND c.user_id = ?`,
      [conversationId, userId]
    ) as [ImageRow[], unknown]

    for (const image of images) {
      await storageService.deleteImage(image.url, image.storage_type)
      if (image.fallback_url) {
        await storageService.deleteImage(image.fallback_url, image.storage_type)
      }
    }

    await getPool().execute(
      'DELETE FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    )
  },

  async updateConversationTitle(conversationId: string, userId: string, title: string) {
    await getPool().execute(
      'UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?',
      [title, conversationId, userId]
    )
  },

  async getMessagesPaginated(conversationId: string, userId: string, options: PaginationOptions = {}) {
    const { limit = 20, before, after } = options
    const safeLimit = Math.max(1, Math.min(typeof limit === 'string' ? parseInt(limit, 10) : limit || 20, 100))

    const [convRows] = await getPool().execute(
      'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    ) as [ConversationRow[], unknown]

    if (convRows.length === 0) {
      return null
    }

    let whereClause = 'm.conversation_id = ?'
    const params: string[] = [conversationId]

    if (before) {
      whereClause += ' AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)'
      params.push(before)
    } else if (after) {
      whereClause += ' AND m.created_at > (SELECT created_at FROM messages WHERE id = ?)'
      params.push(after)
    }

    const orderDirection = before ? 'DESC' : (after ? 'ASC' : 'DESC')

    const [messages] = await getPool().execute(
      `SELECT m.*, 
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', i.id, 'url', i.url, 'fallbackUrl', IFNULL(i.fallback_url, ''), 'storageType', i.storage_type))
         FROM images i WHERE i.message_id = m.id) as images
       FROM messages m 
       WHERE ${whereClause}
       ORDER BY m.created_at ${orderDirection}
       LIMIT ${safeLimit}`,
      params
    ) as [MessageRow[], unknown]

    if (orderDirection === 'DESC') {
      messages.reverse()
    }

    const [countResult] = await getPool().execute(
      'SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?',
      [conversationId]
    ) as [Array<{ total: number }>, unknown]

    let hasMoreBefore = false
    let hasMoreAfter = false

    if (messages.length > 0) {
      const firstMessage = messages[0]
      const lastMessage = messages[messages.length - 1]

      const [olderCount] = await getPool().execute(
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND created_at < ?',
        [conversationId, firstMessage.created_at]
      ) as [Array<{ count: number }>, unknown]
      hasMoreBefore = olderCount[0].count > 0

      const [newerCount] = await getPool().execute(
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND created_at > ?',
        [conversationId, lastMessage.created_at]
      ) as [Array<{ count: number }>, unknown]
      hasMoreAfter = newerCount[0].count > 0
    }

    return {
      conversation: convRows[0],
      messages: messages.map((m) => ({
        ...m,
        images: m.images
          ? typeof m.images === 'string'
            ? JSON.parse(m.images)
            : m.images
          : [],
      })),
      pagination: {
        total: countResult[0].total,
        limit: safeLimit,
        hasMoreBefore,
        hasMoreAfter,
      },
    }
  },

  async searchMessages(userId: string, keyword: string, options: SearchOptions = {}) {
    const safeLimit = Math.max(1, Math.min(typeof options.limit === 'string' ? parseInt(options.limit, 10) : options.limit || 20, 50))
    const safeOffset = Math.max(0, typeof options.offset === 'string' ? parseInt(options.offset, 10) : options.offset || 0)

    const [messages] = await getPool().execute(
      `SELECT m.id, m.conversation_id, m.role, m.content, m.created_at,
              c.title as conversation_title,
              MATCH(m.content) AGAINST(? IN BOOLEAN MODE) as relevance
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id AND c.user_id = ?
       WHERE MATCH(m.content) AGAINST(? IN BOOLEAN MODE)
       ORDER BY relevance DESC, m.created_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      [keyword, userId, keyword]
    ) as [Array<{
      id: string
      conversation_id: string
      role: string
      content: string
      created_at: Date
      conversation_title: string
      relevance: number
    }>, unknown]

    const [countResult] = await getPool().execute(
      `SELECT COUNT(*) as total
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id AND c.user_id = ?
       WHERE MATCH(m.content) AGAINST(? IN BOOLEAN MODE)`,
      [userId, keyword]
    ) as [Array<{ total: number }>, unknown]

    return {
      messages: messages.map(m => ({
        id: m.id,
        conversationId: m.conversation_id,
        conversationTitle: m.conversation_title,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        relevance: m.relevance,
      })),
      total: countResult[0].total,
      limit: safeLimit,
      offset: safeOffset,
    }
  },
}
