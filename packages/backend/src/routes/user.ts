import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { register, login, refreshToken, getMe } from '../controllers/user'

export const userRouter = Router()

userRouter.post('/register', register)
userRouter.post('/login', login)
userRouter.post('/refresh', refreshToken)
userRouter.get('/me', authMiddleware, getMe)
