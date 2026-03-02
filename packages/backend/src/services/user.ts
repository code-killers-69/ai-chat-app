import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getPool } from '../config/database'
import type { TokenPayload, UserRow } from '../types'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('环境变量 JWT_SECRET 未设置，拒绝启动。请在 .env 中配置一个安全的密钥。')
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h'
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'

export const userService = {
  async register(username: string, password: string, nickname?: string) {
    const id = uuidv4()
    const hashedPassword = await bcrypt.hash(password, 10)

    try {
      await getPool().execute(
        'INSERT INTO users (id, username, password, nickname) VALUES (?, ?, ?, ?)',
        [id, username, hashedPassword, nickname || username]
      )

      return { id, username, nickname: nickname || username }
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new Error('用户名已存在')
      }
      throw error
    }
  },

  async login(username: string, password: string) {
    const [rows] = await getPool().execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    ) as [UserRow[], unknown]

    if (rows.length === 0) {
      throw new Error('用户名或密码错误')
    }

    const user = rows[0]
    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
      throw new Error('用户名或密码错误')
    }

    const token = this.generateAccessToken(user)
    const refreshToken = this.generateRefreshToken(user)

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
      },
    }
  },

  generateAccessToken(user: Pick<UserRow, 'id' | 'username'>): string {
    return jwt.sign(
      { userId: user.id, username: user.username, type: 'access' },
      JWT_SECRET!,
      { expiresIn: JWT_EXPIRES_IN }
    )
  },

  generateRefreshToken(user: Pick<UserRow, 'id' | 'username'>): string {
    return jwt.sign(
      { userId: user.id, username: user.username, type: 'refresh' },
      JWT_SECRET!,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    )
  },

  async refreshToken(refreshToken: string) {
    const decoded = this.verifyRefreshToken(refreshToken)
    if (!decoded) {
      throw new Error('Refresh token 无效或已过期')
    }
    const user = await this.getUserById(decoded.userId)
    if (!user) {
      throw new Error('用户不存在')
    }
    return {
      token: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
    }
  },

  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as TokenPayload
      if (decoded.type && decoded.type !== 'access') return null
      return decoded
    } catch {
      return null
    }
  },

  verifyRefreshToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as TokenPayload
      if (decoded.type !== 'refresh') return null
      return decoded
    } catch {
      return null
    }
  },

  async getUserById(userId: string) {
    const [rows] = await getPool().execute(
      'SELECT id, username, nickname, avatar, created_at FROM users WHERE id = ?',
      [userId]
    ) as [Pick<UserRow, 'id' | 'username' | 'nickname' | 'avatar' | 'created_at'>[], unknown]
    return rows[0] || null
  },
}
