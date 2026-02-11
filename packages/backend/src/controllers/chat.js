import { aiService } from '../services/ai.js';
import { messageService } from '../services/message.js';

/**
 * 流式聊天（SSE）
 * 支持匿名和登录用户，登录用户自动持久化会话和消息
 */
export async function streamChat(req, res) {
  const { message, images = [], conversationId } = req.body;
  const userId = req.user?.userId;

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
        const conv = await messageService.createConversation(userId, message.slice(0, 50) || '新对话');
        dbConversationId = conv.id;
        res.write(`data: ${JSON.stringify({ type: 'conversation', conversationId: dbConversationId })}\n\n`);
      }

      const imageDataList = images.map((img, idx) => ({
        data: img,
        originalName: `image_${idx}.jpg`,
        mimeType: img.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
      }));

      await messageService.saveUserMessage(dbConversationId, message, imageDataList);
    }

    let fullResponse = '';

    await aiService.streamChat({
      conversationId: dbConversationId || 'anonymous',
      userId: userId || 'anonymous',
      message,
      images,
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
  const { message, images = [], conversationId } = req.body;
  const userId = req.user?.userId;

  try {
    let dbConversationId = conversationId;

    if (userId) {
      if (!dbConversationId) {
        const conv = await messageService.createConversation(userId, message.slice(0, 50) || '新对话');
        dbConversationId = conv.id;
      }

      const imageDataList = images.map((img, idx) => ({
        data: img,
        originalName: `image_${idx}.jpg`,
        mimeType: img.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
      }));

      await messageService.saveUserMessage(dbConversationId, message, imageDataList);
    }

    let fullResponse = '';

    await aiService.streamChat({
      conversationId: dbConversationId || 'anonymous',
      userId: userId || 'anonymous',
      message,
      images,
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
