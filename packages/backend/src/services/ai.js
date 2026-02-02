import OpenAI from 'openai';

// 硅基流动 SiliconFlow - 超低价/免费模型
const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
});

// 模型配置
const MODELS = {
  // 免费文本模型
  text: 'Qwen/Qwen2.5-7B-Instruct',
  // 支持图片的视觉模型（超低价）
  vision: 'Qwen/Qwen2-VL-72B-Instruct',
};

/**
 * AI 服务 - 可扩展设计，支持未来群聊场景
 */
class AIService {
  constructor() {
    this.client = client;
    // 会话历史存储 - 为群聊扩展预留
    this.conversationHistories = new Map();
  }

  /**
   * 获取或创建会话历史
   * @param {string} conversationId - 会话ID（单聊为用户ID，群聊为群ID）
   */
  getConversationHistory(conversationId) {
    if (!this.conversationHistories.has(conversationId)) {
      this.conversationHistories.set(conversationId, []);
    }
    return this.conversationHistories.get(conversationId);
  }

  /**
   * 添加消息到会话历史
   * 注意：图片内容不存入历史，避免后续请求过大
   */
  addToHistory(conversationId, role, content) {
    const history = this.getConversationHistory(conversationId);
    // 如果是包含图片的消息，只保留文本部分
    const textContent = Array.isArray(content) 
      ? content.find(c => c.type === 'text')?.text || '' 
      : content;
    if (textContent) {
      history.push({ role, content: textContent });
    }
    // 保持历史记录在合理范围内（最近20条）
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
  }

  /**
   * 构建消息内容（支持文本和图片）
   */
  buildMessageContent(text, images = []) {
    if (images.length === 0) {
      return text || '你好';
    }

    const content = [];
    
    if (text) {
      content.push({ type: 'text', text });
    }

    for (const image of images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`,
        },
      });
    }

    return content;
  }

  /**
   * 流式聊天 - 核心方法
   * @param {Object} options
   * @param {string} options.conversationId - 会话ID
   * @param {string} options.userId - 用户ID（为群聊预留）
   * @param {string} options.message - 用户消息
   * @param {Array} options.images - 图片数组 (base64)
   * @param {Function} options.onChunk - 流式数据回调
   * @param {Function} options.onComplete - 完成回调
   */
  async streamChat({ conversationId, userId, message, images = [], onChunk, onComplete }) {
    const messageContent = this.buildMessageContent(message, images);
    
    const history = this.getConversationHistory(conversationId);
    
    // 选择模型：有图片用视觉模型，否则用免费文本模型
    const model = images.length > 0 ? MODELS.vision : MODELS.text;

    // 构建消息列表
    const messages = [
      {
        role: 'system',
        content: '你是一个友好的AI助手，可以帮助用户解答问题、分析图片内容。请用简洁清晰的方式回答。',
      },
      ...history,
      { role: 'user', content: messageContent },
    ];

    try {
      console.log('Calling AI with model:', model);
      
      const stream = await this.client.chat.completions.create({
        model,
        messages,
        stream: true,
        max_tokens: 2048,
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onChunk?.(content);
        }
      }

      // 记录到历史
      this.addToHistory(conversationId, 'user', messageContent);
      this.addToHistory(conversationId, 'assistant', fullResponse);
      onComplete?.(fullResponse);

      return fullResponse;
    } catch (error) {
      console.error('AI Service Error:', error.message);
      console.error('Error details:', error);
      throw error;
    }
  }

  /**
   * 清除会话历史
   */
  clearHistory(conversationId) {
    this.conversationHistories.delete(conversationId);
  }
}

// 导出单例
export const aiService = new AIService();
