/**
 * Markdown 渲染和文本工具 composable
 * marked + DOMPurify 动态导入 — 首屏不加载，首次渲染 AI 回复时才加载
 */

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

// 预加载：首次 idle 时提前加载 marked + DOMPurify，避免首条 AI 回复闪白
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => ensureMarked())
} else {
  setTimeout(() => ensureMarked(), 2000)
}

export function useMarkdown() {
  function renderMarkdown(content) {
    if (!content) return ''
    // marked 已加载则同步渲染并消毒，未加载则先返回纯文本（极端情况）
    if (markedParse && purify) return purify(markedParse(content))
    // 兜底：触发加载，返回转义文本
    ensureMarked()
    return escapeHtml(content)
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
    escapeHtml,
  }
}
