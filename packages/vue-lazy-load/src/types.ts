// ─── 公开类型定义 ─────────────────────────────────────────

/** 缓存配置选项 */
export interface CacheOptions {
  maxMemory?: number
  maxIdb?: number
  persistent?: boolean
}

/** 缓存统计信息 */
export interface CacheStats {
  hits: number
  misses: number
  hitRate: string
  size: number
}

/** v-lazy 指令全局配置 */
export interface LazyOptions {
  rootMargin: string
  loading: string
  error: string
}

/** 插件安装选项 */
export interface LazyLoadPluginOptions {
  /** IntersectionObserver rootMargin，默认 '200px' */
  rootMargin?: string
  /** 加载中占位图 URL */
  loading?: string
  /** 加载失败占位图 URL */
  error?: string
  /** 是否开启 IndexedDB 持久化缓存 */
  persistent?: boolean
  /** L1 内存缓存最大条目数 */
  maxMemory?: number
  /** L2 IndexedDB 最大条目数 */
  maxIdb?: number
}
