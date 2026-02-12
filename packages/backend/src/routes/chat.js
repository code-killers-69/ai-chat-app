import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { uploadImages } from '../middleware/upload.js';
import { streamChat, sendMessage, getModels, healthCheck } from '../controllers/chat.js';

export const chatRouter = Router();

chatRouter.get('/models', getModels);
chatRouter.post('/stream', optionalAuth, uploadImages, streamChat);
chatRouter.post('/message', optionalAuth, uploadImages, sendMessage);
chatRouter.get('/health', healthCheck);
