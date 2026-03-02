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

import type { App, Plugin } from 'vue'
import { lazyDirective, setGlobalOptions } from './directive'
import { setCacheOptions, clearImageCache, getCacheStats } from './cache'
import type { LazyLoadPluginOptions } from './types'

export type * from './types'

// 暴露缓存管理 API（不暴露内部查询方法，避免用户绕过指令直接操作缓存）
export { clearImageCache, getCacheStats }

/**
 * Vue 插件安装函数
 */
export const VueLazyLoad: Plugin = {
  install(app: App, options: LazyLoadPluginOptions = {}) {
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
