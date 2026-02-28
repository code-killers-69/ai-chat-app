import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { storageService } from '../services/storage.js';

/**
 * 分片上传管理
 * 内存维护上传状态，分片暂存磁盘临时目录
 */

const CHUNK_DIR = path.resolve(process.env.LOCAL_STORAGE_PATH || './uploads', '.chunks');
const UPLOAD_TTL = 30 * 60 * 1000; // 30 分钟超时

// 上传状态: uploadId → { filename, mimeType, totalChunks, receivedChunks: Set, createdAt }
const uploads = new Map();

// 确保临时目录存在
if (!fs.existsSync(CHUNK_DIR)) {
  fs.mkdirSync(CHUNK_DIR, { recursive: true });
}

// 定期清理过期上传
setInterval(() => {
  const now = Date.now();
  for (const [id, state] of uploads) {
    if (now - state.createdAt > UPLOAD_TTL) {
      cleanupUpload(id);
      uploads.delete(id);
    }
  }
}, 60_000);

function getChunkPath(uploadId, index) {
  return path.join(CHUNK_DIR, `${uploadId}_${index}`);
}

function cleanupUpload(uploadId) {
  const state = uploads.get(uploadId);
  if (!state) return;
  for (let i = 0; i < state.totalChunks; i++) {
    const p = getChunkPath(uploadId, i);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

/**
 * 初始化分片上传
 * Body: { filename, mimeType, totalChunks, fileSize }
 */
export async function initUpload(req, res) {
  const { filename, mimeType, totalChunks, fileSize } = req.body;

  if (!filename || !totalChunks || totalChunks < 1) {
    return res.status(400).json({ success: false, error: '参数不完整' });
  }

  // 限制单文件最大 50MB
  if (fileSize && fileSize > 50 * 1024 * 1024) {
    return res.status(400).json({ success: false, error: '文件不能超过 50MB' });
  }

  const uploadId = uuidv4();
  uploads.set(uploadId, {
    filename,
    mimeType: mimeType || 'image/jpeg',
    totalChunks,
    receivedChunks: new Set(),
    createdAt: Date.now(),
  });

  res.json({
    success: true,
    data: {
      uploadId,
      // 告诉客户端哪些分片已上传（断点续传用）
      receivedChunks: [],
    },
  });
}

/**
 * 上传单个分片
 * Body: multipart/form-data { uploadId, chunkIndex, chunk (file) }
 */
export async function uploadChunk(req, res) {
  const uploadId = req.body.uploadId;
  const chunkIndex = parseInt(req.body.chunkIndex, 10);
  const chunkFile = req.file;

  if (!uploadId || isNaN(chunkIndex) || !chunkFile) {
    return res.status(400).json({ success: false, error: '参数不完整' });
  }

  const state = uploads.get(uploadId);
  if (!state) {
    return res.status(404).json({ success: false, error: '上传会话不存在或已过期' });
  }

  if (chunkIndex < 0 || chunkIndex >= state.totalChunks) {
    return res.status(400).json({ success: false, error: '分片索引越界' });
  }

  // 幂等：重复上传同一分片直接返回成功
  if (state.receivedChunks.has(chunkIndex)) {
    return res.json({ success: true, data: { chunkIndex, duplicate: true } });
  }

  // 写入临时文件
  const chunkPath = getChunkPath(uploadId, chunkIndex);
  fs.writeFileSync(chunkPath, chunkFile.buffer);
  state.receivedChunks.add(chunkIndex);

  res.json({
    success: true,
    data: {
      chunkIndex,
      received: state.receivedChunks.size,
      total: state.totalChunks,
    },
  });
}

/**
 * 合并分片
 * Body: { uploadId }
 */
export async function completeUpload(req, res) {
  const { uploadId } = req.body;
  const state = uploads.get(uploadId);

  if (!state) {
    return res.status(404).json({ success: false, error: '上传会话不存在或已过期' });
  }

  if (state.receivedChunks.size < state.totalChunks) {
    return res.status(400).json({
      success: false,
      error: `分片不完整：已收到 ${state.receivedChunks.size}/${state.totalChunks}`,
      data: { receivedChunks: [...state.receivedChunks] },
    });
  }

  try {
    // 按顺序合并所有分片
    const buffers = [];
    for (let i = 0; i < state.totalChunks; i++) {
      const chunkPath = getChunkPath(uploadId, i);
      buffers.push(fs.readFileSync(chunkPath));
    }
    const mergedBuffer = Buffer.concat(buffers);

    // 通过 storageService 保存
    const result = await storageService.saveImage(mergedBuffer, state.filename, state.mimeType);

    // 清理分片临时文件
    cleanupUpload(uploadId);
    uploads.delete(uploadId);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Complete upload error:', error);
    res.status(500).json({ success: false, error: '合并文件失败' });
  }
}

/**
 * 查询上传进度（断点续传用）
 * GET /api/upload/progress/:uploadId
 */
export async function getProgress(req, res) {
  const state = uploads.get(req.params.uploadId);

  if (!state) {
    return res.json({
      success: true,
      data: { exists: false },
    });
  }

  res.json({
    success: true,
    data: {
      exists: true,
      totalChunks: state.totalChunks,
      receivedChunks: [...state.receivedChunks],
    },
  });
}
