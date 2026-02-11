import { aiService } from '../services/ai.js';
import { messageService } from '../services/message.js';

/**
 * 统一处理图片：同时兼容 multipart 上传和 JSON base64 两种方式
 *
 * - multipart：图片在 req.files（multer memoryStorage 解析的 Buffer）
 * - JSON：图片在 req.body.images（base64 data URL 字符串数组）
 *
 * 无论哪种方式，都返回统一格式：
 * @param {Object} req - Express 请求对象
 * @returns {{ imageDataList: Array, base64Images: Array }}
 *   - imageDataList: 用于存储服务（Buffer/string + 元数据）
 *   - base64Images: 用于 AI 接口（data URL 字符串）
 */
function extractImages(req) {
  const imageDataList = [];
  const base64Images = [];

  // 优先使用 multipart 上传的文件（新方式）
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      imageDataList.push({
        data: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      });
      const base64 = file.buffer.toString('base64');
      base64Images.push(`data:${file.mimetype};base64,${base64}`);
    }
    return { imageDataList, base64Images };
  }

  // 兼容旧方式：JSON body 里的 base64 图片数组
  const bodyImages = req.body?.images;
  if (Array.isArray(bodyImages) && bodyImages.length > 0) {
    for (const dataUrl of bodyImages) {
      if (typeof dataUrl !== 'string') continue;

      // data URL 直接给 AI 接口用
      base64Images.push(dataUrl);

      // 解析 mime 类型，交给存储服务（storageService.saveImage 支持 base64 string）
      const mimeMatch = dataUrl.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      imageDataList.push({
        data: dataUrl,            // storage.saveImage 会自动处理 base64 string
        originalName: 'image.jpg',
        mimeType,
      });
    }
  }

  return { imageDataList, base64Images };
}

/**
 * 流式聊天（SSE）
 * 支持匿名和登录用户，登录用户自动持久化会话和消息
 */
export async function streamChat(req, res) {
  const { message, conversationId } = req.body;
  const userId = req.user?.userId;
  const { imageDataList, base64Images } = extractImages(req);

  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let dbConversationId = conversationId;

  try {
    // 如果用户已登录，进行持久化
    if (userId) {
      if (!dbConversationId) {
        const conv = await messageService.createConversation(userId, (message || '').slice(0, 50) || '新对话');
        dbConversationId = conv.id;
        res.write(`data: ${JSON.stringify({ type: 'conversation', conversationId: dbConversationId })}\n\n`);
      }

      await messageService.saveUserMessage(dbConversationId, message, imageDataList);
    }

    let fullResponse = '';

    await aiService.streamChat({
      conversationId: dbConversationId || 'anonymous',
      userId: userId || 'anonymous',
      message,
      images: base64Images, // AI 接口需要 base64 data URL
      onChunk: (chunk) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      onComplete: async (response) => {
        if (userId && dbConversationId) {
          await messageService.saveAssistantMessage(dbConversationId, response);
        }
        res.write(`data: ${JSON.stringify({ type: 'done', content: response })}\n\n`);
        res.end();
      },
    });
  } catch (error) {
    console.error('Stream chat error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
}

/**
 * 普通聊天（非流式）
 */
export async function sendMessage(req, res) {
  const { message, conversationId } = req.body;
  const userId = req.user?.userId;
  const { imageDataList, base64Images } = extractImages(req);

  try {
    let dbConversationId = conversationId;

    if (userId) {
      if (!dbConversationId) {
        const conv = await messageService.createConversation(userId, (message || '').slice(0, 50) || '新对话');
        dbConversationId = conv.id;
      }

      await messageService.saveUserMessage(dbConversationId, message, imageDataList);
    }

    let fullResponse = '';

    await aiService.streamChat({
      conversationId: dbConversationId || 'anonymous',
      userId: userId || 'anonymous',
      message,
      images: base64Images,
      onChunk: (chunk) => {
        fullResponse += chunk;
      },
      onComplete: async () => {
        if (userId && dbConversationId) {
          await messageService.saveAssistantMessage(dbConversationId, fullResponse);
        }
      },
    });

    res.json({
      success: true,
      data: {
        content: fullResponse,
        conversationId: dbConversationId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 清除会话历史（内存中的）
 */
export function clearHistory(req, res) {
  const { conversationId } = req.params;
  aiService.clearHistory(conversationId);
  res.json({ success: true, message: 'History cleared' });
}

/**
 * 健康检查
 */
export function healthCheck(req, res) {
  res.json({ status: 'ok' });
}
