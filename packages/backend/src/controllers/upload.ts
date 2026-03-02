import type { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { storageService } from '../services/storage'
import type { AuthRequest, UploadState } from '../types'

/**
 * 分片上传管理
 */

const CHUNK_DIR = path.resolve(process.env.LOCAL_STORAGE_PATH || './uploads', '.chunks')
const UPLOAD_TTL = 30 * 60 * 1000 // 30 分钟超时

const uploads = new Map<string, UploadState>()

if (!fs.existsSync(CHUNK_DIR)) {
  fs.mkdirSync(CHUNK_DIR, { recursive: true })
}

setInterval(() => {
  const now = Date.now()
  for (const [id, state] of uploads) {
    if (now - state.createdAt > UPLOAD_TTL) {
      cleanupUpload(id)
      uploads.delete(id)
    }
  }
}, 60_000)

function getChunkPath(uploadId: string, index: number): string {
  return path.join(CHUNK_DIR, `${uploadId}_${index}`)
}

function cleanupUpload(uploadId: string): void {
  const state = uploads.get(uploadId)
  if (!state) return
  for (let i = 0; i < state.totalChunks; i++) {
    const p = getChunkPath(uploadId, i)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}

/**
 * 初始化分片上传
 */
export async function initUpload(req: AuthRequest, res: Response): Promise<void> {
  const { filename, mimeType, totalChunks, fileSize } = req.body

  if (!filename || !totalChunks || totalChunks < 1) {
    res.status(400).json({ success: false, error: '参数不完整' })
    return
  }

  if (fileSize && fileSize > 50 * 1024 * 1024) {
    res.status(400).json({ success: false, error: '文件不能超过 50MB' })
    return
  }

  const uploadId = uuidv4()
  uploads.set(uploadId, {
    filename,
    mimeType: mimeType || 'image/jpeg',
    totalChunks,
    receivedChunks: new Set(),
    createdAt: Date.now(),
  })

  res.json({
    success: true,
    data: {
      uploadId,
      receivedChunks: [],
    },
  })
}

/**
 * 上传单个分片
 */
export async function uploadChunk(req: AuthRequest, res: Response): Promise<void> {
  const uploadId = req.body.uploadId
  const chunkIndex = parseInt(req.body.chunkIndex, 10)
  const chunkFile = req.file

  if (!uploadId || isNaN(chunkIndex) || !chunkFile) {
    res.status(400).json({ success: false, error: '参数不完整' })
    return
  }

  const state = uploads.get(uploadId)
  if (!state) {
    res.status(404).json({ success: false, error: '上传会话不存在或已过期' })
    return
  }

  if (chunkIndex < 0 || chunkIndex >= state.totalChunks) {
    res.status(400).json({ success: false, error: '分片索引越界' })
    return
  }

  if (state.receivedChunks.has(chunkIndex)) {
    res.json({ success: true, data: { chunkIndex, duplicate: true } })
    return
  }

  const chunkPath = getChunkPath(uploadId, chunkIndex)
  fs.writeFileSync(chunkPath, chunkFile.buffer)
  state.receivedChunks.add(chunkIndex)

  res.json({
    success: true,
    data: {
      chunkIndex,
      received: state.receivedChunks.size,
      total: state.totalChunks,
    },
  })
}

/**
 * 合并分片
 */
export async function completeUpload(req: AuthRequest, res: Response): Promise<void> {
  const { uploadId } = req.body
  const state = uploads.get(uploadId)

  if (!state) {
    res.status(404).json({ success: false, error: '上传会话不存在或已过期' })
    return
  }

  if (state.receivedChunks.size < state.totalChunks) {
    res.status(400).json({
      success: false,
      error: `分片不完整：已收到 ${state.receivedChunks.size}/${state.totalChunks}`,
      data: { receivedChunks: [...state.receivedChunks] },
    })
    return
  }

  try {
    const buffers: Buffer[] = []
    for (let i = 0; i < state.totalChunks; i++) {
      const chunkPath = getChunkPath(uploadId, i)
      buffers.push(fs.readFileSync(chunkPath))
    }
    const mergedBuffer = Buffer.concat(buffers)

    const result = await storageService.saveImage(mergedBuffer, state.filename, state.mimeType)

    cleanupUpload(uploadId)
    uploads.delete(uploadId)

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Complete upload error:', error)
    res.status(500).json({ success: false, error: '合并文件失败' })
  }
}

/**
 * 查询上传进度
 */
export async function getProgress(req: AuthRequest, res: Response): Promise<void> {
  const state = uploads.get(req.params.uploadId as string)

  if (!state) {
    res.json({
      success: true,
      data: { exists: false },
    })
    return
  }

  res.json({
    success: true,
    data: {
      exists: true,
      totalChunks: state.totalChunks,
      receivedChunks: [...state.receivedChunks],
    },
  })
}
