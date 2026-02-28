/**
 * 图片两级缓存模块
 * L1: 内存 LRU Cache（限制条目数，热数据零延迟）
 * L2: IndexedDB 持久化存储 Blob（刷新后仍命中，避免重复下载）
 *
 * 对外 API 保持不变，内部升级为两级缓存架构。
 */

// ─── 配置 ───────────────────────────────────────────────

const DEFAULT_MAX_MEMORY = 150      // L1 内存最大条目数
const DEFAULT_MAX_IDB = 500         // L2 IndexedDB 最大条目数
const DB_NAME = 'vue-lazy-img-cache'
const STORE_NAME = 'blobs'
const DB_VERSION = 1

let maxMemory = DEFAULT_MAX_MEMORY
let maxIdb = DEFAULT_MAX_IDB

/**
 * 可选：设置缓存容量上限
 */
export function setCacheOptions(opts = {}) {
  if (opts.maxMemory) maxMemory = opts.maxMemory
  if (opts.maxIdb) maxIdb = opts.maxIdb
}

// ─── L1: 内存 LRU Cache ─────────────────────────────────

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity
    this.map = new Map()        // key → blobUrl, 按访问顺序排列
    this._hits = 0
    this._misses = 0
  }

  get(key) {
    if (!this.map.has(key)) {
      this._misses++
      return undefined
    }
    this._hits++
    // 移到末尾（最近使用）
    const value = this.map.get(key)
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  has(key) {
    return this.map.has(key)
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.capacity) {
      // 淘汰最久未使用的（第一个）
      const oldest = this.map.keys().next().value
      const oldUrl = this.map.get(oldest)
      this.map.delete(oldest)
      // 释放 blob URL 内存
      URL.revokeObjectURL(oldUrl)
    }
    this.map.set(key, value)
  }

  clear() {
    for (const blobUrl of this.map.values()) {
      URL.revokeObjectURL(blobUrl)
    }
    this.map.clear()
  }

  get size() {
    return this.map.size
  }

  /** 缓存命中率统计 */
  get stats() {
    const total = this._hits + this._misses
    return {
      hits: this._hits,
      misses: this._misses,
      hitRate: total ? (this._hits / total * 100).toFixed(1) + '%' : '0%',
      size: this.map.size,
    }
  }
}

const l1 = new LRUCache(maxMemory)

// ─── L2: IndexedDB 持久化 ───────────────────────────────

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' })
        store.createIndex('accessedAt', 'accessedAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

async function idbGet(url) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(url)
      req.onsuccess = () => {
        const record = req.result
        if (record) {
          // 更新访问时间
          record.accessedAt = Date.now()
          store.put(record)
          resolve(record.blob)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function idbPut(url, blob) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ url, blob, accessedAt: Date.now() })

    // 检查数量，超出则淘汰最旧
    const countReq = store.count()
    countReq.onsuccess = () => {
      if (countReq.result > maxIdb) {
        const idx = store.index('accessedAt')
        const toDelete = countReq.result - maxIdb
        let deleted = 0
        const cursor = idx.openCursor()
        cursor.onsuccess = () => {
          const c = cursor.result
          if (c && deleted < toDelete) {
            c.delete()
            deleted++
            c.continue()
          }
        }
      }
    }
  } catch {
    // IndexedDB 写入失败不影响功能
  }
}

async function idbClear() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
  } catch {
    // ignore
  }
}

// ─── 请求去重 ───────────────────────────────────────────

const pending = new Map()

// ─── 对外 API ───────────────────────────────────────────

/**
 * 异步获取图片的缓存 blob URL
 * 查找顺序: L1(内存) → L2(IndexedDB) → 网络 fetch
 * @param {string} url - 原始图片 URL
 * @returns {Promise<string>} blob URL（失败时回退到原始 URL）
 */
export async function getCachedImage(url) {
  if (!url) return ''

  // L1 命中
  const l1Hit = l1.get(url)
  if (l1Hit) return l1Hit

  // 去重：同一 URL 只发一次请求
  if (pending.has(url)) return pending.get(url)

  const promise = resolveImage(url)
  pending.set(url, promise)
  try {
    return await promise
  } finally {
    pending.delete(url)
  }
}

async function resolveImage(url) {
  // L2 命中 → 提升到 L1
  const idbBlob = await idbGet(url)
  if (idbBlob) {
    const blobUrl = URL.createObjectURL(idbBlob)
    l1.set(url, blobUrl)
    return blobUrl
  }

  // 网络 fetch → 写入 L1 + L2
  return fetchAndCache(url)
}

/**
 * 同步获取已缓存的 blob URL（仅查 L1 内存）
 * @param {string} url
 * @returns {string|null}
 */
export function getCachedImageSync(url) {
  return l1.get(url) || null
}

/**
 * 同步检查是否在 L1 中已缓存
 * @param {string} url
 * @returns {boolean}
 */
export function hasCachedImage(url) {
  return l1.has(url)
}

/**
 * 清除所有缓存（L1 + L2）
 */
export function clearImageCache() {
  l1.clear()
  idbClear()
}

/**
 * 获取缓存统计信息
 * @returns {{ hits: number, misses: number, hitRate: string, size: number }}
 */
export function getCacheStats() {
  return l1.stats
}

// ─── 内部实现 ───────────────────────────────────────────

async function fetchAndCache(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return url
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    // 写入 L1
    l1.set(url, blobUrl)
    // 异步写入 L2（不阻塞返回）
    idbPut(url, blob)

    return blobUrl
  } catch {
    return url
  }
}
