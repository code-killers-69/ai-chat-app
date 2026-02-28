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
   * 流式发送消息（支持断线重连 + 消息幂等）
   *
   * 重连机制：
   * - 首次请求获取 streamId
   * - 网络断开后，用 Last-Event-ID 重连，从断点续收
   * - 基于 seq 的幂等去重，避免重复 chunk
   */
  async streamMessage({ message, images = [], onChunk, onComplete, onError, onConversationCreated }) {
    const originalFiles = images
      .filter(img => img.originalFile)
      .map(img => img.originalFile);

    const MAX_RECONNECT = 3;
    const RECONNECT_DELAY = 1000;

    let streamId = null;
    let lastEventId = null;
    let processedSeqs = new Set(); // 幂等去重
    let reconnectCount = 0;
    let completed = false;

    const buildStreamOptions = () => {
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
        return { formData };
      }
      const body = { message, conversationId: this.conversationId };
      if (this.selectedModel) {
        body.model = this.selectedModel;
      }
      return { body };
    };

    const processStream = async () => {
      try {
        const streamOptions = buildStreamOptions();
        // 断线重连时带上 Last-Event-ID
        if (lastEventId) {
          streamOptions.headers = { 'Last-Event-ID': lastEventId };
        }

        const response = await http.requestStream('/chat/stream', streamOptions);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            // 解析 SSE 标准格式：id: xxx\ndata: xxx
            let eventId = null;
            let eventData = null;

            for (const line of event.split('\n')) {
              if (line.startsWith('id: ')) {
                eventId = line.slice(4);
              } else if (line.startsWith('data: ')) {
                eventData = line.slice(6);
              }
            }

            if (!eventData) continue;

            // 更新 lastEventId（用于重连）
            if (eventId) {
              lastEventId = eventId;

              // 幂等去重：跳过已处理的 seq
              const seq = parseInt(eventId.split(':')[1], 10);
              if (processedSeqs.has(seq)) continue;
              processedSeqs.add(seq);
            }

            try {
              const data = JSON.parse(eventData);

              if (data.type === 'stream-id') {
                streamId = data.streamId;
              } else if (data.type === 'conversation') {
                this.conversationId = data.conversationId;
                onConversationCreated?.(data.conversationId);
              } else if (data.type === 'chunk') {
                onChunk?.(data.content);
              } else if (data.type === 'done') {
                completed = true;
                onComplete?.(data.content);
                if (data.imageIds && data.imageIds.length > 0 && originalFiles.length > 0) {
                  this._uploadFallbacks(data.imageIds, originalFiles);
                }
              } else if (data.type === 'error') {
                completed = true;
                onError?.(new Error(data.message));
              }
            } catch (e) {
              console.warn('Parse SSE data error:', e);
            }
          }
        }
      } catch (error) {
        // 如果已完成或重连次数用尽，抛出错误
        if (completed) return;

        if (reconnectCount < MAX_RECONNECT && lastEventId) {
          reconnectCount++;
          console.info(`SSE 断线，第 ${reconnectCount} 次重连...`);
          await new Promise(r => setTimeout(r, RECONNECT_DELAY * reconnectCount));
          return processStream(); // 递归重连
        }

        console.error('Stream message error:', error);
        onError?.(error);
      }
    };

    await processStream();
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
