/**
 * 图片内存缓存模块
 * fetch 图片 → blob URL → 存入 Map，避免重复网络请求。
 */

const cache = new Map()
const pending = new Map()

/**
 * 异步获取图片的缓存 blob URL（首次会 fetch 并缓存）
 * @param {string} url - 原始图片 URL
 * @returns {Promise<string>} blob URL（失败时回退到原始 URL）
 */
export async function getCachedImage(url) {
  if (!url) return ''
  if (cache.has(url)) return cache.get(url)
  if (pending.has(url)) return pending.get(url)

  const promise = fetchAndCache(url)
  pending.set(url, promise)
  try {
    return await promise
  } finally {
    pending.delete(url)
  }
}

/**
 * 同步获取已缓存的 blob URL（未缓存返回 null）
 * @param {string} url
 * @returns {string|null}
 */
export function getCachedImageSync(url) {
  return cache.get(url) || null
}

/**
 * 同步检查是否已缓存
 * @param {string} url
 * @returns {boolean}
 */
export function hasCachedImage(url) {
  return cache.has(url)
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

async function fetchAndCache(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return url
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    cache.set(url, blobUrl)
    return blobUrl
  } catch {
    return url
  }
}
