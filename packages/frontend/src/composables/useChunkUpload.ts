/**
 * 分片上传 composable
 * 基于 Web Worker 的文件分片上传，支持：
 * - 大文件自动分片（256KB/片）
 * - Worker 内并行上传（3 并发）
 * - 断点续传（服务端记录已上传分片）
 * - 实时上传进度回调
 * - 分片级重试（3 次）
 *
 * 小文件（< 256KB）直接走普通上传，不走分片
 */

import ChunkUploadWorker from '@/workers/chunk-upload.worker.js?worker'
import { http } from '@/api/http'
import type { ChunkUploadOptions, ChunkUploadResult, ApiResponse } from '@/types'

const CHUNK_THRESHOLD = 256 * 1024 // 超过 256KB 才走分片

export function useChunkUpload() {
  /**
   * 上传文件（自动判断走分片或普通上传）
   */
  async function upload(file: File | Blob, options: ChunkUploadOptions = {}): Promise<ChunkUploadResult> {
    const { filename, mimeType, onProgress } = options

    // 小文件走普通上传
    if (file.size <= CHUNK_THRESHOLD) {
      const formData = new FormData()
      formData.append('images', file, filename)
      const res = await http.requestFormData('/chat/upload-fallbacks', formData)
      const data: ApiResponse<ChunkUploadResult> = await res.json()
      if (!data.success) throw new Error(data.error || '上传失败')
      return data.data
    }

    // 大文件走 Worker 分片上传
    return new Promise<ChunkUploadResult>((resolve, reject) => {
      const worker = new ChunkUploadWorker()

      worker.postMessage({
        file,
        filename: filename || (file instanceof File ? file.name : 'image.jpg'),
        mimeType: mimeType || file.type || 'image/jpeg',
        token: http.token,
        apiBase: '/api',
      })

      worker.addEventListener('message', (e: MessageEvent) => {
        const msg = e.data
        if (msg.type === 'progress') {
          onProgress?.(msg)
        } else if (msg.type === 'complete') {
          worker.terminate()
          if (msg.success) {
            resolve(msg.data)
          } else {
            reject(new Error(msg.error))
          }
        }
      })

      worker.addEventListener('error', (e: ErrorEvent) => {
        worker.terminate()
        reject(new Error(e.message || '上传 Worker 异常'))
      })
    })
  }

  return { upload }
}
