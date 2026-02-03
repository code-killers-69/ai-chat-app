import { Router } from 'express';
import { aiService } from '../services/ai.js';
import { messageService } from '../services/message.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';

export const chatRouter = Router();

/**
 * 流式聊天接口（支持持久化）
 * POST /api/chat/stream
 */
chatRouter.post('/stream', optionalAuth, async (req, res) => {
  const { message, images = [], conversationId } = req.body;
  const userId = req.user?.userId;

  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let dbConversationId = conversationId;
  let userMessageSaved = false;

  try {
    // 如果用户已登录，进行持久化
    if (userId) {
      // 如果没有会话ID，创建新会话
      if (!dbConversationId) {
        const conv = await messageService.createConversation(userId, message.slice(0, 50) || '新对话');
        dbConversationId = conv.id;
        // 发送会话ID给前端
        res.write(`data: ${JSON.stringify({ type: 'conversation', conversationId: dbConversationId })}\n\n`);
      }

      // 处理图片数据
      const imageDataList = images.map((img, idx) => ({
        data: img,
        originalName: `image_${idx}.jpg`,
        mimeType: img.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
      }));

      // 保存用户消息
      await messageService.saveUserMessage(dbConversationId, message, imageDataList);
      userMessageSaved = true;
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
        // 如果用户已登录，保存AI回复
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
});

/**
 * 普通聊天接口（非流式）
 * POST /api/chat/message
 */
chatRouter.post('/message', optionalAuth, async (req, res) => {
  const { message, images = [], conversationId } = req.body;
  const userId = req.user?.userId;

  try {
    let dbConversationId = conversationId;

    // 如果用户已登录，进行持久化
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 清除会话历史（内存中的）
 * DELETE /api/chat/history/:conversationId
 */
chatRouter.delete('/history/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  aiService.clearHistory(conversationId);
  res.json({ success: true, message: 'History cleared' });
});

/**
 * 健康检查
 * GET /api/chat/health
 */
chatRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
