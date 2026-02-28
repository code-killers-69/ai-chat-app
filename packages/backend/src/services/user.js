import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('环境变量 JWT_SECRET 未设置，拒绝启动。请在 .env 中配置一个安全的密钥。');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export const userService = {
  /**
   * 注册用户
   */
  async register(username, password, nickname) {
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    try {
      await getPool().execute(
        'INSERT INTO users (id, username, password, nickname) VALUES (?, ?, ?, ?)',
        [id, username, hashedPassword, nickname || username]
      );
      
      return { id, username, nickname: nickname || username };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('用户名已存在');
      }
      throw error;
    }
  },

  /**
   * 登录
   */
  async login(username, password) {
    const [rows] = await getPool().execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (rows.length === 0) {
      throw new Error('用户名或密码错误');
    }
    
    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      throw new Error('用户名或密码错误');
    }
    
    const token = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar
      }
    };
  },

  /**
   * 生成 Access Token（短期）
   */
  generateAccessToken(user) {
    return jwt.sign(
      { userId: user.id, username: user.username, type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  },

  /**
   * 生成 Refresh Token（长期）
   */
  generateRefreshToken(user) {
    return jwt.sign(
      { userId: user.id, username: user.username, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
  },

  /**
   * 刷新 token：验证 refreshToken，签发新 accessToken + refreshToken
   */
  async refreshToken(refreshToken) {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error('Refresh token 无效或已过期');
    }
    const user = await this.getUserById(decoded.userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    return {
      token: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
    };
  },

  /**
   * 验证 access token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type && decoded.type !== 'access') return null;
      return decoded;
    } catch {
      return null;
    }
  },

  /**
   * 验证 refresh token
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== 'refresh') return null;
      return decoded;
    } catch {
      return null;
    }
  },

  /**
   * 获取用户信息
   */
  async getUserById(userId) {
    const [rows] = await getPool().execute(
      'SELECT id, username, nickname, avatar, created_at FROM users WHERE id = ?',
      [userId]
    );
    return rows[0] || null;
  }
};
