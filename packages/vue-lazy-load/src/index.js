/**
 * @code-killer/vue-lazy-load
 * Vue 3 图片懒加载插件
 *
 * 使用方式：
 *   import { VueLazyLoad } from '@code-killer/vue-lazy-load'
 *   app.use(VueLazyLoad, { rootMargin: '200px', loading: '', error: '' })
 *
 * 指令用法：
 *   <img v-lazy="url" />
 *   <img v-lazy="{ src: url, fallback: fallbackUrl }" />
 */

import { lazyDirective, setGlobalOptions } from './directive.js'
import { setCacheOptions, clearImageCache, getCacheStats } from './cache.js'

// 暴露缓存管理 API（不暴露内部查询方法，避免用户绕过指令直接操作缓存）
export { clearImageCache, getCacheStats }

/**
 * Vue 插件安装函数
 * @param {import('vue').App} app
 * @param {object} [options]
 * @param {string}  [options.rootMargin='200px'] - IntersectionObserver rootMargin
 * @param {string}  [options.loading]            - 加载中占位图 URL
 * @param {string}  [options.error]              - 加载失败占位图 URL
 * @param {boolean} [options.persistent=false]   - 是否开启 IndexedDB 持久化缓存
 * @param {number}  [options.maxMemory=150]      - L1 内存缓存最大条目数
 * @param {number}  [options.maxIdb=500]         - L2 IndexedDB 最大条目数
 */
export const VueLazyLoad = {
  install(app, options = {}) {
    const { rootMargin, loading, error, persistent, maxMemory, maxIdb } = options

    if (rootMargin || loading || error) {
      setGlobalOptions({ rootMargin, loading, error })
    }

    if (persistent !== undefined || maxMemory || maxIdb) {
      setCacheOptions({ persistent, maxMemory, maxIdb })
    }

    app.directive('lazy', lazyDirective)
  },
}

export default VueLazyLoad
