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

export { getCachedImage, getCachedImageSync, hasCachedImage, clearImageCache, getCacheStats, setCacheOptions } from './cache.js'
export { lazyDirective, setGlobalOptions }

/**
 * Vue 插件安装函数
 * @param {import('vue').App} app
 * @param {object} [options]
 * @param {string} [options.rootMargin='200px'] - IntersectionObserver rootMargin
 * @param {string} [options.loading] - 加载中占位图 URL
 * @param {string} [options.error] - 加载失败占位图 URL
 */
export const VueLazyLoad = {
  install(app, options = {}) {
    if (options.rootMargin || options.loading || options.error) {
      setGlobalOptions(options)
    }
    app.directive('lazy', lazyDirective)
  },
}

export default VueLazyLoad
