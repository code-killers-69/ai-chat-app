/**
 * v-lazy 指令
 *
 * 用法：
 *   <img v-lazy="imageUrl" />
 *   <img v-lazy="{ src: imageUrl, fallback: fallbackUrl }" />
 *
 * 行为：
 *   1. 挂载时检查缓存 → 命中则同步赋 src（零延迟）
 *   2. 缓存未命中 → IntersectionObserver 监听，进入视口时 fetch + 缓存 + 赋 src
 *   3. 支持 fallback：主图加载失败自动切换到兜底图
 *   4. 支持全局默认配置（rootMargin、loading 占位图、error 占位图）
 *   5. 更新时（v-lazy 值变化）重新走懒加载流程
 */

import { getCachedImage, getCachedImageSync } from './cache.js'

/** @type {{ rootMargin: string, loading: string, error: string }} */
let globalOptions = {
  rootMargin: '200px',
  loading: '',
  error: '',
}

/**
 * 设置全局默认配置
 */
export function setGlobalOptions(opts) {
  Object.assign(globalOptions, opts)
}

/**
 * 解析指令绑定值
 * @param {string|object} value
 * @returns {{ src: string, fallback: string }}
 */
function parseBinding(value) {
  if (typeof value === 'string') {
    return { src: value, fallback: '' }
  }
  return { src: value?.src || '', fallback: value?.fallback || '' }
}

/**
 * 加载图片并赋值给 <img>.src
 */
async function loadImage(el, src, fallback) {
  try {
    const blobUrl = await getCachedImage(src)
    el.src = blobUrl

    // 监听主图加载失败 → 切换 fallback
    if (fallback) {
      el._lazyErrorHandler = async () => {
        const fbUrl = await getCachedImage(fallback)
        el.src = fbUrl
        el.removeEventListener('error', el._lazyErrorHandler)
        el._lazyErrorHandler = null
      }
      el.addEventListener('error', el._lazyErrorHandler)
    }
  } catch {
    if (fallback) {
      try {
        el.src = await getCachedImage(fallback)
      } catch {
        el.src = globalOptions.error || fallback
      }
    } else if (globalOptions.error) {
      el.src = globalOptions.error
    }
  }
}

/**
 * 清理元素上的 observer 和事件监听
 */
function cleanup(el) {
  if (el._lazyObserver) {
    el._lazyObserver.disconnect()
    el._lazyObserver = null
  }
  if (el._lazyErrorHandler) {
    el.removeEventListener('error', el._lazyErrorHandler)
    el._lazyErrorHandler = null
  }
}

export const lazyDirective = {
  mounted(el, binding) {
    const { src, fallback } = parseBinding(binding.value)
    if (!src) return

    // 设置 loading 占位
    if (globalOptions.loading) {
      el.src = globalOptions.loading
    }

    // 缓存命中 → 同步赋值，零延迟
    const cached = getCachedImageSync(src)
    if (cached) {
      el.src = cached
      // fallback 也尝试同步获取
      if (fallback) {
        el._lazyErrorHandler = async () => {
          el.src = await getCachedImage(fallback)
          el.removeEventListener('error', el._lazyErrorHandler)
          el._lazyErrorHandler = null
        }
        el.addEventListener('error', el._lazyErrorHandler)
      }
      return
    }

    // 缓存未命中 → IntersectionObserver 懒加载
    el._lazyObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el._lazyObserver.unobserve(el)
            el._lazyObserver = null
            loadImage(el, src, fallback)
            break
          }
        }
      },
      { rootMargin: globalOptions.rootMargin },
    )
    el._lazyObserver.observe(el)
  },

  updated(el, binding) {
    if (binding.value === binding.oldValue) return

    const { src, fallback } = parseBinding(binding.value)
    if (!src) return

    cleanup(el)

    const cached = getCachedImageSync(src)
    if (cached) {
      el.src = cached
      if (fallback) {
        el._lazyErrorHandler = async () => {
          el.src = await getCachedImage(fallback)
          el.removeEventListener('error', el._lazyErrorHandler)
          el._lazyErrorHandler = null
        }
        el.addEventListener('error', el._lazyErrorHandler)
      }
      return
    }

    if (globalOptions.loading) {
      el.src = globalOptions.loading
    }

    el._lazyObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el._lazyObserver.unobserve(el)
            el._lazyObserver = null
            loadImage(el, src, fallback)
            break
          }
        }
      },
      { rootMargin: globalOptions.rootMargin },
    )
    el._lazyObserver.observe(el)
  },

  unmounted(el) {
    cleanup(el)
  },
}
