/**
 * 消息图片模型
 */
export class MessageImage {
  /**
   * @param {object} options
   * @param {string} [options.id] - 图片ID（后端返回）
   * @param {string} [options.url] - 图片URL（后端返回的 CDN/COS/本地地址）
   * @param {string} [options.imageUrl] - 图片URL（前端本地 blob URL）
   * @param {string} [options.storageType] - 存储类型：local | cdn | cos
   * @param {File} [options.file] - 原始 File 对象（用于 multipart 上传）
   */
  constructor({ id = '', url = '', imageUrl = '', storageType = 'local', file = null } = {}) {
    this.id = id;
    this.url = url;
    this.imageUrl = imageUrl;
    this.storageType = storageType;
    this.file = file;
  }

  /**
   * 获取可显示的图片地址（优先 imageUrl，其次 url）
   */
  get displayUrl() {
    return this.imageUrl || this.url;
  }
}

/**
 * 聊天消息模型
 *
 * 前端角色映射：后端 'user' → 前端 'me'，后端 'assistant' → 前端 'you'
 */
export class Message {
  /**
   * @param {object} options
   * @param {string} options.id - 消息ID
   * @param {string} options.content - 消息内容
   * @param {string} options.time - 显示时间（HH:mm 格式）
   * @param {'me'|'you'} options.role - 前端角色：'me'（用户）/ 'you'（AI）
   * @param {MessageImage[]} [options.images] - 附带图片列表
   * @param {boolean} [options.isStreaming] - 是否正在流式输出中
   */
  constructor({ id, content, time, role, images = [], isStreaming = false }) {
    this.id = id;
    this.content = content;
    this.time = time;
    this.role = role;
    this.images = images.map(img => img instanceof MessageImage ? img : new MessageImage(img));
    this.isStreaming = isStreaming;
  }

  /**
   * 从后端消息数据创建 Message 实例
   * @param {object} serverMsg - 后端返回的消息对象
   * @param {string} serverMsg.id
   * @param {string} serverMsg.content
   * @param {string} serverMsg.created_at - ISO 时间戳
   * @param {'user'|'assistant'} serverMsg.role - 后端角色
   * @param {Array} [serverMsg.images]
   * @returns {Message}
   */
  static fromServer(serverMsg) {
    return new Message({
      id: serverMsg.id,
      content: serverMsg.content,
      time: Message.formatTime(serverMsg.created_at),
      role: serverMsg.role === 'user' ? 'me' : 'you',
      images: (serverMsg.images || []).map(img => new MessageImage(img)),
      isStreaming: false,
    });
  }

  /**
   * 创建用户发送的消息
   * @param {object} options
   * @param {string} options.content - 消息文本
   * @param {MessageImage[]} [options.images] - 附带图片
   * @returns {Message}
   */
  static createUserMessage({ content, images = [] }) {
    return new Message({
      id: Message.generateId(),
      content,
      time: Message.getNowTime(),
      role: 'me',
      images,
    });
  }

  /**
   * 创建 AI 流式响应占位消息
   * @returns {Message}
   */
  static createStreamingPlaceholder() {
    return new Message({
      id: Message.generateId(),
      content: '',
      time: Message.getNowTime(),
      role: 'you',
      isStreaming: true,
    });
  }

  /**
   * 追加流式内容
   * @param {string} chunk
   */
  appendContent(chunk) {
    this.content += chunk;
  }

  /**
   * 结束流式输出
   */
  finishStreaming() {
    this.isStreaming = false;
  }

  /**
   * 设置错误内容并结束流式
   * @param {string} errorMessage
   */
  setError(errorMessage) {
    this.content = `抱歉，发生错误：${errorMessage}`;
    this.isStreaming = false;
  }

  // ---- 工具方法 ----

  static _idCounter = 0;

  static generateId() {
    return `msg_${Date.now()}_${++Message._idCounter}`;
  }

  static getNowTime() {
    const date = new Date();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  static formatTime(dateStr) {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
}
