import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database.js';
import { storageService } from './storage.js';

export const messageService = {
  /**
   * 创建会话
   */
  async createConversation(userId, title = '新对话') {
    const id = uuidv4();
    await getPool().execute(
      'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)',
      [id, userId, title]
    );
    return { id, userId, title, createdAt: new Date() };
  },

  /**
   * 获取用户的所有会话
   */
  async getConversations(userId) {
    const [rows] = await getPool().execute(
      `SELECT c.*, 
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM conversations c 
       WHERE c.user_id = ? 
       ORDER BY c.updated_at DESC`,
      [userId]
    );
    return rows;
  },

  /**
   * 获取会话详情（包含消息）
   */
  async getConversationWithMessages(conversationId, userId) {
    // 验证会话所有权
    const [convRows] = await getPool().execute(
      'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    );

    if (convRows.length === 0) {
      return null;
    }

    // 获取消息
    const [messages] = await getPool().execute(
      `SELECT m.*, 
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', i.id, 'url', i.url, 'storageType', i.storage_type))
         FROM images i WHERE i.message_id = m.id) as images
       FROM messages m 
       WHERE m.conversation_id = ? 
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

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
    };
  },

  /**
   * 保存用户消息
   */
  async saveUserMessage(conversationId, content, imageDataList = []) {
    const messageId = uuidv4();

    await getPool().execute(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)',
      [messageId, conversationId, 'user', content]
    );

    // 保存图片
    const savedImages = [];
    for (const imageData of imageDataList) {
      const { url, storageType, size } = await storageService.saveImage(
        imageData.data,
        imageData.originalName || 'image.jpg',
        imageData.mimeType || 'image/jpeg'
      );

      const imageId = uuidv4();
      await getPool().execute(
        'INSERT INTO images (id, message_id, storage_type, url, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          imageId,
          messageId,
          storageType,
          url,
          imageData.originalName,
          imageData.mimeType,
          size,
        ]
      );

      savedImages.push({ id: imageId, url, storageType });
    }

    // 更新会话时间
    await getPool().execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );

    return {
      id: messageId,
      role: 'user',
      content,
      images: savedImages,
      createdAt: new Date(),
    };
  },

  /**
   * 保存 AI 消息
   */
  async saveAssistantMessage(conversationId, content) {
    const messageId = uuidv4();

    await getPool().execute(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)',
      [messageId, conversationId, 'assistant', content]
    );

    // 更新会话时间
    await getPool().execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );

    return { id: messageId, role: 'assistant', content, createdAt: new Date() };
  },

  /**
   * 删除会话
   */
  async deleteConversation(conversationId, userId) {
    // 先获取所有图片以便删除
    const [images] = await getPool().execute(
      `SELECT i.* FROM images i 
       JOIN messages m ON i.message_id = m.id 
       JOIN conversations c ON m.conversation_id = c.id 
       WHERE c.id = ? AND c.user_id = ?`,
      [conversationId, userId]
    );

    // 删除图片文件
    for (const image of images) {
      await storageService.deleteImage(image.url, image.storage_type);
    }

    // 删除会话（级联删除消息和图片记录）
    await getPool().execute(
      'DELETE FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    );
  },

  /**
   * 更新会话标题
   */
  async updateConversationTitle(conversationId, userId, title) {
    await getPool().execute(
      'UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?',
      [title, conversationId, userId]
    );
  },

  /**
   * 分页获取会话消息（储备接口）
   * @param {string} conversationId - 会话ID
   * @param {string} userId - 用户ID
   * @param {Object} options - 分页选项
   * @param {number} options.limit - 每页数量，默认20
   * @param {string} options.before - 获取此消息ID之前的消息（向上滚动加载更早的）
   * @param {string} options.after - 获取此消息ID之后的消息（向下加载更新的）
   */
  async getMessagesPaginated(conversationId, userId, options = {}) {
    const { limit = 20, before, after } = options;

    // 验证会话所有权
    const [convRows] = await getPool().execute(
      'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    );

    if (convRows.length === 0) {
      return null;
    }

    // 构建查询条件
    let whereClause = 'm.conversation_id = ?';
    const params = [conversationId];

    if (before) {
      // 获取指定消息之前的消息（更早的）
      whereClause += ' AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)';
      params.push(before);
    } else if (after) {
      // 获取指定消息之后的消息（更新的）
      whereClause += ' AND m.created_at > (SELECT created_at FROM messages WHERE id = ?)';
      params.push(after);
    }

    params.push(limit);

    // 获取消息
    // before 查询或默认：按时间倒序取最近的 N 条，再反转为正序
    // after 查询：按时间正序取
    const orderDirection = before ? 'DESC' : (after ? 'ASC' : 'DESC');
    
    const [messages] = await getPool().execute(
      `SELECT m.*, 
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', i.id, 'url', i.url, 'storageType', i.storage_type))
         FROM images i WHERE i.message_id = m.id) as images
       FROM messages m 
       WHERE ${whereClause}
       ORDER BY m.created_at ${orderDirection}
       LIMIT ?`,
      params
    );

    // 如果是倒序取的，反转回正序
    if (orderDirection === 'DESC') {
      messages.reverse();
    }

    // 获取总消息数
    const [countResult] = await getPool().execute(
      'SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?',
      [conversationId]
    );

    // 判断是否还有更早的消息
    let hasMoreBefore = false;
    let hasMoreAfter = false;
    
    if (messages.length > 0) {
      const firstMessage = messages[0];
      const lastMessage = messages[messages.length - 1];
      
      const [olderCount] = await getPool().execute(
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND created_at < ?',
        [conversationId, firstMessage.created_at]
      );
      hasMoreBefore = olderCount[0].count > 0;

      const [newerCount] = await getPool().execute(
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND created_at > ?',
        [conversationId, lastMessage.created_at]
      );
      hasMoreAfter = newerCount[0].count > 0;
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
        limit,
        hasMoreBefore,
        hasMoreAfter,
      },
    };
  },
};
