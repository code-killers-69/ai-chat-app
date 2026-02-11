import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { register, login, getMe } from '../controllers/user.js';

export const userRouter = Router();

userRouter.post('/register', register);
userRouter.post('/login', login);
userRouter.get('/me', authMiddleware, getMe);
