import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getConversations,
  createConversation,
  getConversationInfo,
  getConversationDetail,
  updateConversation,
  deleteConversation,
  getMessages,
} from '../controllers/conversation.js';

export const conversationRouter = Router();

// 所有路由都需要登录
conversationRouter.use(authMiddleware);

conversationRouter.get('/', getConversations);
conversationRouter.post('/', createConversation);
conversationRouter.get('/:id/info', getConversationInfo);
conversationRouter.get('/:id', getConversationDetail);
conversationRouter.put('/:id', updateConversation);
conversationRouter.delete('/:id', deleteConversation);
conversationRouter.get('/:id/messages', getMessages);
