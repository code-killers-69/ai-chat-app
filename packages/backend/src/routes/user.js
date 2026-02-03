import { Router } from 'express';
import { userService } from '../services/user.js';
import { authMiddleware } from '../middleware/auth.js';

export const userRouter = Router();

/**
 * 注册
 * POST /api/user/register
 */
userRouter.post('/register', async (req, res) => {
  const { username, password, nickname } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }
  
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ success: false, error: '用户名长度需在 3-50 字符之间' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: '密码长度至少 6 位' });
  }
  
  try {
    const user = await userService.register(username, password, nickname);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 登录
 * POST /api/user/login
 */
userRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }
  
  try {
    const result = await userService.login(username, password);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

/**
 * 获取当前用户信息
 * GET /api/user/me
 */
userRouter.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await userService.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
