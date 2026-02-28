/**
 * Markdown 渲染 composable — 主线程 + Web Worker 双通道
 *
 * 架构：
 * - 主线程：marked + DOMPurify 动态导入，用于流式实时渲染（同步，低延迟）
 * - Worker 线程：独立加载 marked + DOMPurify，用于批量/完整消息渲染（异步，零阻塞）
 *
 * 流式场景：renderMarkdown() 走主线程（同步，保证逐字输出不卡顿）
 * 历史加载：renderMarkdownAsync() / renderMarkdownBatch() 走 Worker（不阻塞 UI）
 * 流式结束：可调用 renderMarkdownAsync() 重新渲染最终结果替换
 */

import MarkdownWorker from '@/workers/markdown.worker.js?worker'

// ─── 主线程渲染（同步兜底）─────────────────────────────────

let markedParse = null
let purify = null

async function ensureMarked() {
  if (markedParse) return
  const [{ marked }, DOMPurify] = await Promise.all([
    import('marked'),
    import('dompurify').then(m => m.default || m),
  ])
  marked.setOptions({ breaks: true, gfm: true })
  markedParse = marked.parse.bind(marked)
  purify = DOMPurify.sanitize.bind(DOMPurify)
}

// 预加载主线程 marked（用于流式渲染兜底）
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => ensureMarked())
} else {
  setTimeout(() => ensureMarked(), 2000)
}

// ─── Worker 通道 ────────────────────────────────────────

let worker = null
let reqId = 0
const pendingCallbacks = new Map()

function getWorker() {
  if (worker) return worker
  try {
    worker = new MarkdownWorker()
    worker.addEventListener('message', (e) => {
      const { id, html, batch } = e.data
      const resolve = pendingCallbacks.get(id)
      if (resolve) {
        pendingCallbacks.delete(id)
        resolve(batch || html)
      }
    })
    worker.addEventListener('error', () => {
      // Worker 出错后置空，下次调用会走主线程兜底
      worker?.terminate()
      worker = null
    })
  } catch {
    // Worker 创建失败（如 SSR 环境），走主线程兜底
    worker = null
  }
  return worker
}

// 空闲时预创建 Worker
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => getWorker())
} else {
  setTimeout(() => getWorker(), 1000)
}

// ─── 对外 API ───────────────────────────────────────────

export function useMarkdown() {
  /**
   * 同步渲染 Markdown（主线程，用于流式场景）
   */
  function renderMarkdown(content) {
    if (!content) return ''
    if (markedParse && purify) return purify(markedParse(content))
    ensureMarked()
    return escapeHtml(content)
  }

  /**
   * 异步渲染 Markdown（Worker 线程，用于完整消息/历史加载）
   * Worker 不可用时自动降级到主线程
   */
  function renderMarkdownAsync(content) {
    if (!content) return Promise.resolve('')

    const w = getWorker()
    if (w) {
      return new Promise((resolve) => {
        const id = ++reqId
        pendingCallbacks.set(id, resolve)
        w.postMessage({ id, content })
        // 超时兜底：3 秒未响应走主线程
        setTimeout(() => {
          if (pendingCallbacks.has(id)) {
            pendingCallbacks.delete(id)
            resolve(renderMarkdown(content))
          }
        }, 3000)
      })
    }

    // 降级到主线程
    return Promise.resolve(renderMarkdown(content))
  }

  /**
   * 批量异步渲染（Worker 线程，加载大量历史消息时使用）
   * @param {Array<{key: string, content: string}>} items
   * @returns {Promise<Array<{key: string, html: string}>>}
   */
  function renderMarkdownBatch(items) {
    if (!items || items.length === 0) return Promise.resolve([])

    const w = getWorker()
    if (w) {
      return new Promise((resolve) => {
        const id = ++reqId
        pendingCallbacks.set(id, resolve)
        w.postMessage({ id, batch: items })
        setTimeout(() => {
          if (pendingCallbacks.has(id)) {
            pendingCallbacks.delete(id)
            // 降级到主线程
            resolve(items.map(item => ({
              key: item.key,
              html: renderMarkdown(item.content),
            })))
          }
        }, 5000)
      })
    }

    return Promise.resolve(items.map(item => ({
      key: item.key,
      html: renderMarkdown(item.content),
    })))
  }

  function escapeHtml(text) {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>')
  }

  return {
    renderMarkdown,
    renderMarkdownAsync,
    renderMarkdownBatch,
    escapeHtml,
  }
}
