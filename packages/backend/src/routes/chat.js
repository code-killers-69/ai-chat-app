import { Router } from 'express';
import { aiService } from '../services/ai.js';

export const chatRouter = Router();

/**
 * 流式聊天接口
 * POST /api/chat/stream
 */
chatRouter.post('/stream', async (req, res) => {
  const { message, images = [], conversationId = 'default', userId = 'anonymous' } = req.body;

  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    await aiService.streamChat({
      conversationId,
      userId,
      message,
      images,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      onComplete: (fullResponse) => {
        res.write(`data: ${JSON.stringify({ type: 'done', content: fullResponse })}\n\n`);
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
chatRouter.post('/message', async (req, res) => {
  const { message, images = [], conversationId = 'default', userId = 'anonymous' } = req.body;

  try {
    let fullResponse = '';
    
    await aiService.streamChat({
      conversationId,
      userId,
      message,
      images,
      onChunk: (chunk) => {
        fullResponse += chunk;
      },
      onComplete: () => {},
    });

    res.json({
      success: true,
      data: {
        content: fullResponse,
        conversationId,
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
 * 清除会话历史
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
