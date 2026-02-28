import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { initUpload, uploadChunk, completeUpload, getProgress } from '../controllers/upload.js';

export const uploadRouter = Router();

const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 单个分片最大 1MB
}).single('chunk');

uploadRouter.post('/init', authMiddleware, initUpload);
uploadRouter.post('/chunk', authMiddleware, chunkUpload, uploadChunk);
uploadRouter.post('/complete', authMiddleware, completeUpload);
uploadRouter.get('/progress/:uploadId', authMiddleware, getProgress);
