import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { streamChat, sendMessage, clearHistory, healthCheck } from '../controllers/chat.js';

export const chatRouter = Router();

chatRouter.post('/stream', optionalAuth, streamChat);
chatRouter.post('/message', optionalAuth, sendMessage);
chatRouter.delete('/history/:conversationId', clearHistory);
chatRouter.get('/health', healthCheck);
