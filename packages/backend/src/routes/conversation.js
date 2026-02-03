import { Router } from 'express';
import { messageService } from '../services/message.js';
import { authMiddleware } from '../middleware/auth.js';

export const conversationRouter = Router();

// 所有路由都需要登录
conversationRouter.use(authMiddleware);

/**
 * 获取会话列表
 * GET /api/conversations
 */
conversationRouter.get('/', async (req, res) => {
  try {
    const conversations = await messageService.getConversations(req.user.userId);
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 创建新会话
 * POST /api/conversations
 */
conversationRouter.post('/', async (req, res) => {
  const { title } = req.body;
  
  try {
    const conversation = await messageService.createConversation(req.user.userId, title);
    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取会话详情（包含消息）
 * GET /api/conversations/:id
 */
conversationRouter.get('/:id', async (req, res) => {
  try {
    const conversation = await messageService.getConversationWithMessages(
      req.params.id,
      req.user.userId
    );
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }
    
    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新会话标题
 * PUT /api/conversations/:id
 */
conversationRouter.put('/:id', async (req, res) => {
  const { title } = req.body;
  
  if (!title) {
    return res.status(400).json({ success: false, error: '标题不能为空' });
  }
  
  try {
    await messageService.updateConversationTitle(req.params.id, req.user.userId, title);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除会话
 * DELETE /api/conversations/:id
 */
conversationRouter.delete('/:id', async (req, res) => {
  try {
    await messageService.deleteConversation(req.params.id, req.user.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
