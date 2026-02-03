import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
    
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar
      }
    };
  },

  /**
   * 验证 token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
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
