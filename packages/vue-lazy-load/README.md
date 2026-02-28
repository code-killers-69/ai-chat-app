# @code-killer/vue-lazy-load

Vue 3 图片懒加载指令插件，基于 IntersectionObserver + 两级缓存（LRU 内存 + IndexedDB 持久化）。

## 特性

- **IntersectionObserver 懒加载** — 图片进入视口时才加载，减少首屏请求
- **两级缓存架构** — L1 内存 LRU Cache + L2 IndexedDB 持久化，刷新页面后仍可命中缓存
- **LRU 淘汰策略** — L1 基于 Map 插入顺序实现 LRU，淘汰时自动 `URL.revokeObjectURL` 释放 Blob 内存
- **IndexedDB 自动淘汰** — L2 超出上限时按 `accessedAt` 索引游标淘汰最久未访问的记录
- **请求去重** — 多个 `<img>` 同时引用同一 URL，只发一次网络请求
- **缓存命中零延迟** — 已缓存的图片同步赋值 src，无闪烁
- **fallback 兜底图** — 主图加载失败自动切换到备用图
- **全局配置** — 支持自定义 loading 占位图、error 占位图、预加载距离、缓存容量

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
  persistent: false,           // 可选：是否开启 L2 IndexedDB 持久化缓存，默认 false
  maxMemory: 150,              // 可选：L1 内存缓存最大条目数，默认 150
  maxIdb: 500,                 // 可选：L2 IndexedDB 最大条目数，默认 500
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
  getCachedImage,      // 异步获取缓存（L1 → L2 → fetch，未缓存则网络请求）
  getCachedImageSync,  // 同步获取 L1 内存缓存（未缓存返回 null）
  hasCachedImage,      // 检查是否在 L1 内存中已缓存
  clearImageCache,     // 清除所有缓存（L1 + L2），释放内存
  getCacheStats,       // 获取 L1 缓存命中率统计
} from '@code-killer/vue-lazy-load'
```

## 缓存架构

```
img 挂载
  → 检查 L1 内存缓存（同步）
    → 命中：直接赋值 src（零延迟，零闪烁）
    → 未命中：注册 IntersectionObserver
      → 进入视口
        → 检查 L2 IndexedDB（异步，仅 persistent 开启时）
          → 命中：创建 Blob URL → 提升到 L1 → 赋值 src
          → 未命中：fetch 图片 → Blob URL → 写入 L1 + L2 → 赋值 src
        → 失败：使用 fallback 或全局 error 占位图
```

### 两级缓存说明

| 层级 | 存储介质 | 容量 | 特点 |
|------|----------|------|------|
| L1 | 内存 Map（LRU） | 默认 150 条 | 同步读取，零延迟，页面刷新后失效 |
| L2 | IndexedDB（Blob） | 默认 500 条 | 异步读取，页面刷新后仍命中，需手动开启 |

- L2 默认关闭，通过 `persistent: true` 开启，尊重用户存储意愿
- L2 命中后自动提升到 L1，后续访问走内存零延迟
- 两级均有自动淘汰机制，不会无限增长

## 配置项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `rootMargin` | `string` | `'200px'` | IntersectionObserver 预加载距离 |
| `loading` | `string` | `''` | 加载中占位图 URL |
| `error` | `string` | `''` | 加载失败占位图 URL |
| `persistent` | `boolean` | `false` | 是否开启 L2 IndexedDB 持久化缓存 |
| `maxMemory` | `number` | `150` | L1 内存缓存最大条目数 |
| `maxIdb` | `number` | `500` | L2 IndexedDB 最大条目数 |

## 要求

- Vue 3.x
- 浏览器支持 IntersectionObserver（覆盖率 > 97%）
- L2 持久化需浏览器支持 IndexedDB（覆盖率 > 98%）

## 更新日志

### v1.1.0

- 新增两级缓存架构：L1 内存 LRU Cache + L2 IndexedDB 持久化存储
- 新增 `persistent` 配置项，控制是否开启 L2 持久化缓存
- 新增 `maxMemory`、`maxIdb` 配置项，支持自定义缓存容量上限
- 新增 `getCacheStats()` API，返回 L1 缓存命中率统计
- L1 淘汰时自动 `URL.revokeObjectURL` 释放 Blob 内存
- L2 超出上限时按访问时间自动淘汰最久未使用的记录

### v1.0.1

- 初始版本：IntersectionObserver 懒加载 + 内存缓存 + 请求去重 + fallback 兜底

## License

MIT
