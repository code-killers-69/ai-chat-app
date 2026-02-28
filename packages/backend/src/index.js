import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { chatRouter } from './routes/chat.js';
import { userRouter } from './routes/user.js';
import { conversationRouter } from './routes/conversation.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initDatabase } from './config/database.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:3000'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务（图片上传目录）
const uploadsPath = process.env.LOCAL_STORAGE_PATH || './uploads';
app.use('/uploads', express.static(path.resolve(uploadsPath)));

// Routes
app.use('/api/chat', chatRouter);
app.use('/api/user', userRouter);
app.use('/api/conversations', conversationRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// 启动服务器
async function start() {
  try {
    // 初始化数据库
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
