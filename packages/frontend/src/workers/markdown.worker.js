/**
 * Markdown 渲染 Web Worker
 * 在独立线程中执行 marked + DOMPurify，主线程零阻塞
 *
 * 消息协议：
 *   请求: { id, content }
 *   响应: { id, html }
 *
 * 支持批量渲染：
 *   请求: { id, batch: [{ key, content }] }
 *   响应: { id, batch: [{ key, html }] }
 */

import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })
const sanitize = DOMPurify.sanitize.bind(DOMPurify)

function render(content) {
  if (!content) return ''
  return sanitize(marked.parse(content))
}

self.addEventListener('message', (e) => {
  const { id, content, batch } = e.data

  if (batch) {
    // 批量渲染
    const results = batch.map(item => ({
      key: item.key,
      html: render(item.content),
    }))
    self.postMessage({ id, batch: results })
  } else {
    // 单条渲染
    self.postMessage({ id, html: render(content) })
  }
})
