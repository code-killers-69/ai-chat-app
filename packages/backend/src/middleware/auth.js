import { userService } from '../services/user.js';

/**
 * JWT 认证中间件
 */
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录' });
  }
  
  const token = authHeader.slice(7);
  const decoded = userService.verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ success: false, error: 'token 无效或已过期' });
  }
  
  req.user = decoded;
  next();
};

/**
 * 可选认证中间件（不强制登录）
 */
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = userService.verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  
  next();
};
