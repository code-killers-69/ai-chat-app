/**
 * 图片压缩工具 — 纯 Canvas 实现，不依赖第三方库
 * 同时输出 webp + jpeg 两份，上传后前端用 <picture> 兜底显示
 * @param {File|Blob} file - 原始图片文件
 * @param {object} [options]
 * @param {number} [options.quality=0.7] - jpeg 压缩质量 0~1
 * @param {number} [options.webpQuality=0.82] - webp 压缩质量 0~1（webp 同数值比 jpeg 更糊，需给更高值）
 * @param {number} [options.maxWidth=2048] - 最大宽度（等比缩放）
 * @param {number} [options.maxHeight=2048] - 最大高度（等比缩放）
 * @returns {Promise<{ file: File, url: string, fallbackFile: File|null }>}
 */

// 检测浏览器是否支持 webp 编码（只检测一次）
let _webpSupported = null

function checkWebpSupport() {
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
function loadImage(file) {
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
function canvasToFile(canvas, mimeType, quality, name) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ? new File([b], name, { type: mimeType }) : null), mimeType, quality)
  })
}

/**
 * 压缩单张图片 — 同时输出 webp 和 jpeg 两份
 * file: 主文件（优先 webp），fallbackFile: 兜底文件（jpeg）
 */
export async function compressImage(file, options = {}) {
  const { quality = 0.7, webpQuality = 0.82, maxWidth = 2048, maxHeight = 2048 } = options

  // 非图片直接返回
  if (!file.type.startsWith('image/')) {
    return { file, url: URL.createObjectURL(file), fallbackFile: null }
  }

  // GIF 不压缩（保留动画）
  if (file.type === 'image/gif') {
    return { file, url: URL.createObjectURL(file), fallbackFile: null }
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
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)

  // 释放 load 时创建的 blob URL
  URL.revokeObjectURL(img.src)

  const baseName = (file.name || 'image').replace(/\.[^.]+$/, '')
  const useWebp = checkWebpSupport()

  // 始终生成 jpeg 作为兜底
  const jpegFile = await canvasToFile(canvas, 'image/jpeg', quality, `${baseName}.jpg`)

  let mainFile
  let fallbackFile = null

  if (useWebp) {
    // 浏览器支持 webp → 主文件 webp，兜底 jpeg
    const webpFile = await canvasToFile(canvas, 'image/webp', webpQuality, `${baseName}.webp`)
    mainFile = webpFile
    fallbackFile = jpegFile
  } else {
    // 不支持 webp → 主文件 jpeg，无需兜底
    mainFile = jpegFile
  }

  // 如果压缩后主文件反而比原文件更大，主文件用原文件
  if (mainFile.size >= file.size) {
    mainFile = file
  }

  const url = URL.createObjectURL(mainFile)
  return { file: mainFile, url, fallbackFile }
}

/**
 * 批量压缩图片
 */
export async function compressImages(files, options = {}) {
  return Promise.all(files.map((f) => compressImage(f, options)))
}
