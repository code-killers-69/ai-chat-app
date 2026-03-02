import { Router } from 'express'
import { optionalAuth, authMiddleware } from '../middleware/auth'
import { uploadImages, uploadFallbacks } from '../middleware/upload'
import { streamChat, sendMessage, getModels, healthCheck, uploadFallbacks as uploadFallbacksHandler } from '../controllers/chat'

export const chatRouter = Router()

chatRouter.get('/models', getModels)
chatRouter.post('/stream', optionalAuth, uploadImages, streamChat)
chatRouter.post('/message', optionalAuth, uploadImages, sendMessage)
chatRouter.post('/upload-fallbacks', authMiddleware, uploadFallbacks, uploadFallbacksHandler)
chatRouter.get('/health', healthCheck)
