const API_BASE = '/api';

/**
 * 聊天 API 服务
 * 设计为可扩展，支持未来群聊场景
 */
class ChatAPI {
  constructor() {
    this.conversationId = this.generateConversationId();
    this.userId = this.generateUserId();
  }

  generateConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  generateUserId() {
    let userId = localStorage.getItem('chat_user_id');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('chat_user_id', userId);
    }
    return userId;
  }

  /**
   * 将图片 URL 转换为 base64
   */
  async imageUrlToBase64(url) {
    // 如果是 blob URL
    if (url.startsWith('blob:')) {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // 返回完整的 data URL
          resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    
    // 如果已经是 base64
    if (url.startsWith('data:')) {
      return url;
    }

    // 普通 URL
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 流式发送消息
   * @param {Object} options
   * @param {string} options.message - 消息内容
   * @param {Array} options.images - 图片 URL 数组
   * @param {Function} options.onChunk - 流式数据回调
   * @param {Function} options.onComplete - 完成回调
   * @param {Function} options.onError - 错误回调
   */
  async streamMessage({ message, images = [], onChunk, onComplete, onError }) {
    try {
      // 转换图片为 base64
      const base64Images = await Promise.all(
        images.map(img => this.imageUrlToBase64(img.imageUrl))
      );

      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          images: base64Images,
          conversationId: this.conversationId,
          userId: this.userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                onChunk?.(data.content);
              } else if (data.type === 'done') {
                onComplete?.(data.content);
              } else if (data.type === 'error') {
                onError?.(new Error(data.message));
              }
            } catch (e) {
              console.warn('Parse SSE data error:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream message error:', error);
      onError?.(error);
    }
  }

  /**
   * 清除会话历史
   */
  async clearHistory() {
    try {
      await fetch(`${API_BASE}/chat/history/${this.conversationId}`, {
        method: 'DELETE',
      });
      // 生成新的会话 ID
      this.conversationId = this.generateConversationId();
    } catch (error) {
      console.error('Clear history error:', error);
    }
  }

  /**
   * 开启新会话
   */
  startNewConversation() {
    this.conversationId = this.generateConversationId();
  }
}

export const chatAPI = new ChatAPI();
