import { http } from './http.js';
import FallbackUploadWorker from '@/workers/fallback-upload.worker.js?worker';

/**
 * 会话 API
 */
class ConversationAPI {
  async getConversations() {
    return http.request('/conversations');
  }

  async getConversation(id) {
    return http.request(`/conversations/${id}`);
  }

  async getConversationInfo(id) {
    return http.request(`/conversations/${id}/info`);
  }

  async createConversation(title) {
    return http.request('/conversations', {
      method: 'POST',
      body: { title },
    });
  }

  async deleteConversation(id) {
    return http.request(`/conversations/${id}`, { method: 'DELETE' });
  }

  async updateTitle(id, title) {
    return http.request(`/conversations/${id}`, {
      method: 'PUT',
      body: { title },
    });
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
    return http.request(`/conversations/${id}/messages${qs ? '?' + qs : ''}`);
  }
}

/**
 * 聊天 API 服务
 */
class ChatAPI {
  constructor() {
    this.auth = http; // 统一使用 http 实例管理 token
    this.conversations = new ConversationAPI();
    this.conversationId = null;
    this.selectedModel = null;
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    return http.request('/chat/models', { auth: false });
  }

  /**
   * 设置当前使用的模型
   */
  setModel(modelId) {
    this.selectedModel = modelId;
  }

  /**
   * 流式发送消息
   */
  async streamMessage({ message, images = [], onChunk, onComplete, onError, onConversationCreated }) {
    const originalFiles = images
      .filter(img => img.originalFile)
      .map(img => img.originalFile);

    try {
      let streamOptions;

      if (images.length > 0) {
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
        streamOptions = { formData };
      } else {
        const body = { message, conversationId: this.conversationId };
        if (this.selectedModel) {
          body.model = this.selectedModel;
        }
        streamOptions = { body };
      }

      const response = await http.requestStream('/chat/stream', streamOptions);

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
   * 通过 Web Worker 后台压缩 jpeg 兜底图 + 上传
   */
  _uploadFallbacks(imageIds, originalFiles) {
    try {
      const worker = new FallbackUploadWorker();
      worker.postMessage({
        imageIds,
        originalFiles,
        token: http.token,
        apiBase: '/api',
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
        await http.request(`/chat/history/${this.conversationId}`, { method: 'DELETE' });
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
