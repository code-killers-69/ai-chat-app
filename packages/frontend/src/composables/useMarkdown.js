/**
 * Markdown 渲染和文本工具 composable
 * marked 动态导入 — 首屏不加载，首次渲染 AI 回复时才加载
 */

let markedParse = null

async function ensureMarked() {
  if (markedParse) return
  const { marked } = await import('marked')
  marked.setOptions({ breaks: true, gfm: true })
  markedParse = marked.parse.bind(marked)
}

// 预加载：首次 idle 时提前加载 marked，避免首条 AI 回复闪白
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => ensureMarked())
} else {
  setTimeout(() => ensureMarked(), 2000)
}

export function useMarkdown() {
  function renderMarkdown(content) {
    if (!content) return ''
    // marked 已加载则同步渲染，未加载则先返回纯文本（极端情况）
    if (markedParse) return markedParse(content)
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
