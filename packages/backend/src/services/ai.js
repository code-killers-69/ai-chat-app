import OpenAI from 'openai';
import { getPool } from '../config/database.js';

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

// 历史记录最大条数
const MAX_HISTORY_LENGTH = 20;

/**
 * AI 服务 - 可扩展设计，支持未来群聊场景
 */
class AIService {
  constructor() {
    this.client = client;
  }

  /**
   * 从数据库获取会话历史记录
   * @param {string} conversationId - 会话ID
   * @param {number} limit - 最大条数，默认20
   */
  async getConversationHistoryFromDB(conversationId, limit = MAX_HISTORY_LENGTH) {
    // 匿名用户或无效会话ID，返回空数组
    if (!conversationId || conversationId === 'anonymous') {
      return [];
    }

    try {
      // 从数据库获取最近的消息（按时间倒序取，再反转为正序）
      // 注意：mysql2 execute (prepared statement) 中 LIMIT ? 可能不支持参数化
      // limit 是内部常量，非用户输入，直接拼接安全
      const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
      const [messages] = await getPool().execute(
        `SELECT role, content FROM messages 
         WHERE conversation_id = ? 
         ORDER BY created_at DESC 
         LIMIT ${safeLimit}`,
        [conversationId]
      );

      // 反转为正序（从旧到新）
      messages.reverse();

      // 只返回 role 和 content，图片不包含在历史中
      return messages.map(m => ({
        role: m.role,
        content: m.content
      }));
    } catch (error) {
      console.error('Failed to load history from DB:', error.message);
      return [];
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
    
    // 从数据库获取历史记录
    const history = await this.getConversationHistoryFromDB(conversationId);
    
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
      console.log('Calling AI with model:', model, '| History count:', history.length);
      
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

      // 历史记录已经保存到数据库（由 chat.js 调用 messageService），无需再内存存储
      await onComplete?.(fullResponse);

      return fullResponse;
    } catch (error) {
      console.error('AI Service Error:', error.message);
      console.error('Error details:', error);
      throw error;
    }
  }

}

// 导出单例
export const aiService = new AIService();
