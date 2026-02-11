/**
 * 图片内存缓存
 * 首次加载时 fetch 图片并转为 blob URL 存入内存，
 * 虚拟列表回滚重建 DOM 时直接使用缓存，无需再次网络请求。
 */

const cache = new Map()
// 正在加载中的 promise，避免同一 URL 并发请求
const pending = new Map()

/**
 * 获取图片的缓存 blob URL
 * @param {string} url - 原始图片 URL
 * @returns {Promise<string>} blob URL
 */
export async function getCachedImage(url) {
  if (!url) return ''

  // 已缓存，直接返回
  if (cache.has(url)) {
    return cache.get(url)
  }

  // 正在加载中，复用同一个 promise
  if (pending.has(url)) {
    return pending.get(url)
  }

  const loadPromise = fetchAndCache(url)
  pending.set(url, loadPromise)

  try {
    const blobUrl = await loadPromise
    return blobUrl
  } finally {
    pending.delete(url)
  }
}

async function fetchAndCache(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      // 加载失败，回退到原始 URL
      return url
    }
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    cache.set(url, blobUrl)
    return blobUrl
  } catch {
    // 网络错误等，回退到原始 URL
    return url
  }
}

/**
 * 同步检查是否已缓存
 */
export function hasCachedImage(url) {
  return cache.has(url)
}

/**
 * 同步获取已缓存的 blob URL（未缓存返回 null）
 */
export function getCachedImageSync(url) {
  return cache.get(url) || null
}

/**
 * 清除所有缓存（释放 blob URL 内存）
 */
export function clearImageCache() {
  for (const blobUrl of cache.values()) {
    URL.revokeObjectURL(blobUrl)
  }
  cache.clear()
}
