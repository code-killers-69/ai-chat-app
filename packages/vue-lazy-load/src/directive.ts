/**
 * v-lazy 指令
 *
 * 用法：
 *   <img v-lazy="imageUrl" />
 *   <img v-lazy="{ src: imageUrl, fallback: fallbackUrl }" />
 */

import type { Directive } from 'vue'
import { getCachedImage, getCachedImageSync } from './cache'
import type { LazyOptions } from './types'

// 扩展 HTMLElement 以存储指令私有数据
interface LazyHTMLElement extends HTMLImageElement {
  _lazyObserver: IntersectionObserver | null
  _lazyErrorHandler: (() => void) | null
}

let globalOptions: LazyOptions = {
  rootMargin: '200px',
  loading: '',
  error: '',
}

/**
 * 设置全局默认配置
 */
export function setGlobalOptions(opts: Partial<LazyOptions>): void {
  Object.assign(globalOptions, opts)
}

/**
 * 解析指令绑定值
 */
function parseBinding(value: string | { src?: string; fallback?: string }): { src: string; fallback: string } {
  if (typeof value === 'string') {
    return { src: value, fallback: '' }
  }
  return { src: value?.src || '', fallback: value?.fallback || '' }
}

/**
 * 加载图片并赋值给 <img>.src
 */
async function loadImage(el: LazyHTMLElement, src: string, fallback: string): Promise<void> {
  try {
    const blobUrl = await getCachedImage(src)
    el.src = blobUrl

    // 监听主图加载失败 → 切换 fallback
    if (fallback) {
      el._lazyErrorHandler = async () => {
        const fbUrl = await getCachedImage(fallback)
        el.src = fbUrl
        el.removeEventListener('error', el._lazyErrorHandler!)
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
function cleanup(el: LazyHTMLElement): void {
  if (el._lazyObserver) {
    el._lazyObserver.disconnect()
    el._lazyObserver = null
  }
  if (el._lazyErrorHandler) {
    el.removeEventListener('error', el._lazyErrorHandler)
    el._lazyErrorHandler = null
  }
}

export const lazyDirective: Directive<LazyHTMLElement, string | { src?: string; fallback?: string }> = {
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
          el.removeEventListener('error', el._lazyErrorHandler!)
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
            el._lazyObserver!.unobserve(el)
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
          el.removeEventListener('error', el._lazyErrorHandler!)
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
            el._lazyObserver!.unobserve(el)
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
