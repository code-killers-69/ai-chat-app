/**
 * 图片压缩工具 — 纯 Canvas 实现，不依赖第三方库
 * 主线程只输出 webp 主图（供即时预览 & 上传），jpeg 兜底图由 Web Worker 后台压缩上传
 */

import type { CompressOptions, CompressResult } from '../types'

// 检测浏览器是否支持 webp 编码（只检测一次）
let _webpSupported: boolean | null = null

function checkWebpSupport(): boolean {
  if (_webpSupported !== null) return _webpSupported
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  _webpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  return _webpSupported
}

/**
 * 将图片文件加载为 HTMLImageElement
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/**
 * canvas → File 的辅助函数
 */
function canvasToFile(canvas: HTMLCanvasElement, mimeType: string, quality: number, name: string): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ? new File([b], name, { type: mimeType }) : null), mimeType, quality)
  })
}

/**
 * 压缩单张图片 — 只输出 webp 主图，jpeg 兜底交给 Worker
 * file: 主文件（webp），originalFile: 原始文件（供 Worker 压缩 jpeg）
 */
export async function compressImage(file: File | Blob, options: CompressOptions = {}): Promise<CompressResult> {
  const { webpQuality = 0.82, maxWidth = 2048, maxHeight = 2048 } = options

  // 非图片直接返回
  if (!file.type.startsWith('image/')) {
    return { file, url: URL.createObjectURL(file), originalFile: null }
  }

  // GIF 不压缩（保留动画）
  if (file.type === 'image/gif') {
    return { file, url: URL.createObjectURL(file), originalFile: null }
  }

  const img = await loadImage(file)

  // 计算缩放尺寸
  let { naturalWidth: w, naturalHeight: h } = img
  if (w > maxWidth || h > maxHeight) {
    const ratio = Math.min(maxWidth / w, maxHeight / h)
    w = Math.round(w * ratio)
    h = Math.round(h * ratio)
  }

  // 绘制到 canvas
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)

  // 释放 load 时创建的 blob URL
  URL.revokeObjectURL(img.src)

  const baseName = ((file instanceof File ? file.name : 'image') || 'image').replace(/\.[^.]+$/, '')
  const useWebp = checkWebpSupport()

  let mainFile: File | Blob

  if (useWebp) {
    mainFile = await canvasToFile(canvas, 'image/webp', webpQuality, `${baseName}.webp`) || file
  } else {
    // 不支持 webp → 用 jpeg 作为主文件，不需要 Worker 再生成兜底
    mainFile = await canvasToFile(canvas, 'image/jpeg', 0.7, `${baseName}.jpg`) || file
  }

  // 如果压缩后反而更大，用原文件
  if (mainFile.size >= file.size) {
    mainFile = file
  }

  const url = URL.createObjectURL(mainFile)
  // 只有使用 webp 时才需要 Worker 生成 jpeg 兜底
  return { file: mainFile, url, originalFile: useWebp ? file : null }
}

/**
 * 批量压缩图片
 */
export async function compressImages(files: (File | Blob)[], options: CompressOptions = {}): Promise<CompressResult[]> {
  return Promise.all(files.map((f) => compressImage(f, options)))
}
