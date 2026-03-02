import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  getConversations,
  createConversation,
  getConversationInfo,
  getConversationDetail,
  updateConversation,
  deleteConversation,
  getMessages,
  searchMessages,
} from '../controllers/conversation'

export const conversationRouter = Router()

// 所有路由都需要登录
conversationRouter.use(authMiddleware)

// 搜索路由必须在 /:id 之前，否则 "search" 会被当作 :id
conversationRouter.get('/search', searchMessages)

conversationRouter.get('/', getConversations)
conversationRouter.post('/', createConversation)
conversationRouter.get('/:id/info', getConversationInfo)
conversationRouter.get('/:id', getConversationDetail)
conversationRouter.put('/:id', updateConversation)
conversationRouter.delete('/:id', deleteConversation)
conversationRouter.get('/:id/messages', getMessages)
