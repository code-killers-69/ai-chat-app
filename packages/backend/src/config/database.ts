import mysql, { type Pool } from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
}
const dbName = process.env.DB_NAME || 'chat_app'

let pool: Pool

// 初始化数据库表
export async function initDatabase(): Promise<void> {
  // 先创建数据库（不指定 database）
  const tempConn = await mysql.createConnection(dbConfig)
  await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await tempConn.end()

  // 创建连接池
  pool = mysql.createPool({
    ...dbConfig,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })

  const connection = await pool.getConnection()

  try {
    // 用户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nickname VARCHAR(100),
        avatar VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    // 会话表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(200) DEFAULT '新对话',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // 消息表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(36) PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL,
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `)

    // 升级：确保 messages.created_at 有毫秒精度
    await connection.execute(
      `ALTER TABLE messages MODIFY created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3)`
    ).catch(() => { /* 已经是 TIMESTAMP(3) 则忽略 */ })

    // 图片表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS images (
        id VARCHAR(36) PRIMARY KEY,
        message_id VARCHAR(36) NOT NULL,
        storage_type ENUM('local', 'cdn', 'cos') DEFAULT 'local',
        url VARCHAR(500) NOT NULL,
        fallback_url VARCHAR(500) DEFAULT '',
        original_name VARCHAR(255),
        mime_type VARCHAR(100),
        size INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `)

    // 升级：为已有 images 表添加 fallback_url 字段
    await connection.execute(
      `ALTER TABLE images ADD COLUMN fallback_url VARCHAR(500) DEFAULT '' AFTER url`
    ).catch(() => { /* 字段已存在则忽略 */ })

    // 升级：为 messages.content 添加全文索引
    await connection.execute(
      `ALTER TABLE messages ADD FULLTEXT INDEX ft_content (content) WITH PARSER ngram`
    ).catch(() => { /* 索引已存在则忽略 */ })

    console.log('Database tables initialized successfully')
  } finally {
    connection.release()
  }
}

export function getPool(): Pool {
  return pool
}

export default { getPool }
