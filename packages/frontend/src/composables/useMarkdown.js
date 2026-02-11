import { marked } from 'marked'

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
})

/**
 * Markdown 渲染和文本工具 composable
 */
export function useMarkdown() {
  function renderMarkdown(content) {
    if (!content) return ''
    return marked.parse(content)
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
