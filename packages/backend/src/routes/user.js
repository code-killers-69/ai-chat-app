import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { register, login, refreshToken, getMe } from '../controllers/user.js';

export const userRouter = Router();

userRouter.post('/register', register);
userRouter.post('/login', login);
userRouter.post('/refresh', refreshToken);
userRouter.get('/me', authMiddleware, getMe);
