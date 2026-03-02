import type { Response } from 'express'
import { userService } from '../services/user'
import type { AuthRequest } from '../types'

/**
 * 注册
 */
export async function register(req: AuthRequest, res: Response): Promise<void> {
  const { username, password, nickname } = req.body

  if (!username || !password) {
    res.status(400).json({ success: false, error: '用户名和密码不能为空' })
    return
  }

  if (username.length < 3 || username.length > 50) {
    res.status(400).json({ success: false, error: '用户名长度需在 3-50 字符之间' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ success: false, error: '密码长度至少 6 位' })
    return
  }

  try {
    const user = await userService.register(username, password, nickname)
    res.json({ success: true, data: user })
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message })
  }
}

/**
 * 登录
 */
export async function login(req: AuthRequest, res: Response): Promise<void> {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ success: false, error: '用户名和密码不能为空' })
    return
  }

  try {
    const result = await userService.login(username, password)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(401).json({ success: false, error: (error as Error).message })
  }
}

/**
 * 刷新 Token
 */
export async function refreshToken(req: AuthRequest, res: Response): Promise<void> {
  const { refreshToken } = req.body

  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'refreshToken 不能为空' })
    return
  }

  try {
    const result = await userService.refreshToken(refreshToken)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(401).json({ success: false, error: 'refreshToken 无效或已过期' })
  }
}

/**
 * 获取当前用户信息
 */
export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await userService.getUserById(req.user!.userId)
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' })
      return
    }
    res.json({ success: true, data: user })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}
