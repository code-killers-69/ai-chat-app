import FallbackUploadWorker from '@/workers/fallback-upload.worker.js?worker';

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
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
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
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
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
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  async getConversation(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      headers: this.auth.getHeaders()
    });
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  async getConversationInfo(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}/info`, {
      headers: this.auth.getHeaders()
    });
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
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
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  async deleteConversation(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE',
      headers: this.auth.getHeaders()
    });
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  }

  async updateTitle(id, title) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'PUT',
      headers: this.auth.getHeaders(),
      body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
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
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
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
    this.selectedModel = null; // 当前选中的模型 ID
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    const res = await fetch(`${API_BASE}/chat/models`);
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  /**
   * 设置当前使用的模型
   */
  setModel(modelId) {
    this.selectedModel = modelId;
  }

  /**
   * 流式发送消息
   * - 有图片 → multipart/form-data（只传主图 webp，不传兜底图）
   * - 无图片 → JSON（兼容老后端）
   * - AI 回复完成后，异步上传兜底图（不阻塞 AI 响应）
   */
  async streamMessage({ message, images = [], onChunk, onComplete, onError, onConversationCreated }) {
    // 收集原始图片文件（供 Worker 压缩 jpeg 兜底图）
    const originalFiles = images
      .filter(img => img.originalFile)
      .map(img => img.originalFile);

    try {
      let response;

      if (images.length > 0) {
        // 有图片：multipart/form-data，只传主图
        const formData = new FormData();
        formData.append('message', message || '');
        if (this.conversationId) {
          formData.append('conversationId', this.conversationId);
        }
        if (this.selectedModel) {
          formData.append('model', this.selectedModel);
        }
        for (const img of images) {
          formData.append('images', img.file);
        }
        response = await fetch(`${API_BASE}/chat/stream`, {
          method: 'POST',
          headers: this.auth.getHeaders(false),
          body: formData,
        });
      } else {
        // 无图片：JSON
        const body = {
          message,
          conversationId: this.conversationId,
        };
        if (this.selectedModel) {
          body.model = this.selectedModel;
        }
        response = await fetch(`${API_BASE}/chat/stream`, {
          method: 'POST',
          headers: this.auth.getHeaders(),
          body: JSON.stringify(body),
        });
      }

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
                // Worker 后台压缩 jpeg + 上传兜底图，不阻塞
                if (data.imageIds && data.imageIds.length > 0 && originalFiles.length > 0) {
                  this._uploadFallbacks(data.imageIds, originalFiles);
                }
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
   * 通过 Web Worker 后台压缩 jpeg 兜底图 + 上传（完全不占用主线程）
   * @param {string[]} imageIds - 后端返回的图片 ID 列表
   * @param {(File|Blob)[]} originalFiles - 原始图片文件，Worker 内压缩成 jpeg
   */
  _uploadFallbacks(imageIds, originalFiles) {
    try {
      const worker = new FallbackUploadWorker();
      worker.postMessage({
        imageIds,
        originalFiles,
        token: this.auth.token,
        apiBase: API_BASE,
      });
      worker.addEventListener('message', (e) => {
        if (!e.data.success) {
          console.warn('Worker upload fallbacks failed:', e.data.error);
        }
        worker.terminate();
      });
      worker.addEventListener('error', (e) => {
        console.warn('Worker error:', e.message);
        worker.terminate();
      });
    } catch (error) {
      console.warn('Upload fallbacks error:', error);
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
