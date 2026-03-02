import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../types'
import { userService } from '../services/user'

/**
 * JWT 认证中间件
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未登录' })
    return
  }

  const token = authHeader.slice(7)
  const decoded = userService.verifyToken(token)

  if (!decoded) {
    res.status(401).json({ success: false, error: 'token 无效或已过期' })
    return
  }

  req.user = decoded
  next()
}

/**
 * 可选认证中间件（不强制登录）
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const decoded = userService.verifyToken(token)
    if (decoded) {
      req.user = decoded
    }
  }

  next()
}
