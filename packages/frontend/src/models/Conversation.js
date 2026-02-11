/**
 * 会话模型
 */
export class Conversation {
  /**
   * @param {object} options
   * @param {string} options.id - 会话ID
   * @param {string} [options.userId] - 所属用户ID
   * @param {string} options.title - 会话标题
   * @param {string} [options.lastMessage] - 最后一条消息内容（列表接口返回）
   * @param {string} options.createdAt - 创建时间（ISO 字符串）
   * @param {string} options.updatedAt - 更新时间（ISO 字符串）
   */
  constructor({ id, userId = '', title = '新对话', lastMessage = '', createdAt = '', updatedAt = '' }) {
    this.id = id;
    this.userId = userId;
    this.title = title;
    this.lastMessage = lastMessage;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * 从后端会话列表数据创建 Conversation 实例
   * @param {object} serverConv - 后端返回的会话对象
   * @returns {Conversation}
   */
  static fromServer(serverConv) {
    return new Conversation({
      id: serverConv.id,
      userId: serverConv.user_id || '',
      title: serverConv.title || '新对话',
      lastMessage: serverConv.last_message || '',
      createdAt: serverConv.created_at || '',
      updatedAt: serverConv.updated_at || '',
    });
  }

  /**
   * 判断缓存是否仍然有效（与服务端 updatedAt 比较）
   * @param {string} serverUpdatedAt - 服务端最新的 updated_at
   * @returns {boolean}
   */
  isCacheValid(serverUpdatedAt) {
    return !!this.updatedAt && this.updatedAt === serverUpdatedAt;
  }
}
