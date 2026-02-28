# @code-killer/vue-lazy-load

Vue 3 图片懒加载指令插件，基于 IntersectionObserver + 内存缓存。

## 特性

- **IntersectionObserver 懒加载** — 图片进入视口时才加载，减少首屏请求
- **内存缓存** — fetch → Blob URL 缓存在 Map 中，同一张图只请求一次
- **请求去重** — 多个 `<img>` 同时引用同一 URL，只发一次网络请求
- **缓存命中零延迟** — 已缓存的图片同步赋值，无闪烁
- **fallback 兜底图** — 主图加载失败自动切换到备用图
- **全局配置** — 支持自定义 loading 占位图、error 占位图、预加载距离

## 安装

```bash
npm install @code-killer/vue-lazy-load
```

## 使用

### 注册插件

```js
import { createApp } from 'vue'
import { VueLazyLoad } from '@code-killer/vue-lazy-load'
import App from './App.vue'

const app = createApp(App)

app.use(VueLazyLoad, {
  rootMargin: '200px',        // 可选：提前加载距离，默认 200px
  loading: '/placeholder.png', // 可选：加载中占位图
  error: '/error.png',         // 可选：加载失败占位图
})

app.mount('#app')
```

### 基本用法

```html
<img v-lazy="imageUrl" />
```

### 带 fallback 兜底图

```html
<img v-lazy="{ src: imageUrl, fallback: fallbackUrl }" />
```

主图加载失败时自动切换到 `fallbackUrl`。

### 缓存 API

```js
import {
  getCachedImage,      // 异步获取缓存（未缓存则 fetch）
  getCachedImageSync,  // 同步获取缓存（未缓存返回 null）
  hasCachedImage,      // 检查是否已缓存
  clearImageCache,     // 清除所有缓存，释放内存
} from '@code-killer/vue-lazy-load'
```

## 工作原理

```
img 挂载
  → 检查内存缓存
    → 命中：同步赋值 src（零延迟）
    → 未命中：注册 IntersectionObserver
      → 进入视口：fetch 图片 → 转 Blob URL → 存入缓存 → 赋值 src
        → 失败：使用 fallback 或全局 error 占位图
```

## 要求

- Vue 3.x
- 浏览器支持 IntersectionObserver（覆盖率 > 97%）

## License

MIT
