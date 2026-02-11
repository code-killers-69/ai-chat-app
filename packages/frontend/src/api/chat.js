const API_BASE = '/api';

/**
 * 用户认证 API
 */
class AuthAPI {
  constructor() {
    this.token = localStorage.getItem('chat_token');
    this.user = JSON.parse(localStorage.getItem('chat_user') || 'null');
  }

  getHeaders(includeContentType = true) {
    const headers = {};
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async register(username, password, nickname) {
    const res = await fetch(`${API_BASE}/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, nickname })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  async login(username, password) {
    const res = await fetch(`${API_BASE}/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    
    this.token = data.data.token;
    this.user = data.data.user;
    localStorage.setItem('chat_token', this.token);
    localStorage.setItem('chat_user', JSON.stringify(this.user));
    
    return data.data;
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
  }

  isLoggedIn() {
    return !!this.token;
  }

  getUser() {
    return this.user;
  }
}

/**
 * 会话 API
 */
class ConversationAPI {
  constructor(authAPI) {
    this.auth = authAPI;
  }

  async getConversations() {
    const res = await fetch(`${API_BASE}/conversations`, {
      headers: this.auth.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  async getConversation(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      headers: this.auth.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  async getConversationInfo(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}/info`, {
      headers: this.auth.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  async createConversation(title) {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: this.auth.getHeaders(),
      body: JSON.stringify({ title })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  async deleteConversation(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE',
      headers: this.auth.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  }

  async updateTitle(id, title) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'PUT',
      headers: this.auth.getHeaders(),
      body: JSON.stringify({ title })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  }

  /**
   * 分页获取会话消息
   * @param {string} id - 会话ID
   * @param {object} options
   * @param {number} [options.limit] - 每页数量
   * @param {string} [options.before] - 获取此消息之前的（更早的）
   * @param {string} [options.after] - 获取此消息之后的（更新的）
   */
  async getMessagesPaginated(id, options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    if (options.before) params.set('before', options.before);
    if (options.after) params.set('after', options.after);
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/conversations/${id}/messages${qs ? '?' + qs : ''}`, {
      headers: this.auth.getHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }
}

/**
 * 聊天 API 服务
 */
class ChatAPI {
  constructor() {
    this.auth = new AuthAPI();
    this.conversations = new ConversationAPI(this.auth);
    this.conversationId = null;
  }

  /**
   * 流式发送消息（multipart/form-data 上传图片）
   */
  async streamMessage({ message, images = [], onChunk, onComplete, onError, onConversationCreated }) {
    try {
      const formData = new FormData();
      formData.append('message', message || '');
      if (this.conversationId) {
        formData.append('conversationId', this.conversationId);
      }

      // 直接把原始 File 对象 append 进去，浏览器自动用 multipart 编码
      for (const img of images) {
        if (img.file) {
          formData.append('images', img.file);
        }
      }

      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: this.auth.getHeaders(false), // 不设置 Content-Type，让浏览器自动加 boundary
        body: formData,
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
              if (data.type === 'conversation') {
                this.conversationId = data.conversationId;
                onConversationCreated?.(data.conversationId);
              } else if (data.type === 'chunk') {
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
    if (this.conversationId) {
      try {
        await fetch(`${API_BASE}/chat/history/${this.conversationId}`, {
          method: 'DELETE',
          headers: this.auth.getHeaders(),
        });
      } catch (error) {
        console.error('Clear history error:', error);
      }
    }
    this.conversationId = null;
  }

  /**
   * 设置当前会话
   */
  setConversation(id) {
    this.conversationId = id;
  }

  /**
   * 开启新会话
   */
  startNewConversation() {
    this.conversationId = null;
  }
}

export const chatAPI = new ChatAPI();
