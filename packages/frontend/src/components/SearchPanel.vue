<template>
  <div class="search-panel" v-if="visible">
    <div class="search-header">
      <div class="search-input-wrapper">
        <input
          ref="searchInputRef"
          v-model="keyword"
          type="text"
          placeholder="搜索消息..."
          class="search-input"
          @input="handleInput"
          @keyup.enter="doSearch"
          @keyup.esc="close"
        />
        <button v-if="keyword" class="clear-btn" @click="clearSearch">×</button>
      </div>
      <button class="close-btn" @click="close">取消</button>
    </div>

    <div class="search-results" v-if="results.length > 0 || loading || noResults">
      <div v-if="loading" class="search-loading">搜索中...</div>

      <div v-else-if="noResults" class="search-empty">未找到相关消息</div>

      <template v-else>
        <div class="results-count">找到 {{ total }} 条结果</div>
        <div
          v-for="item in results"
          :key="item.id"
          class="result-item"
          @click="handleSelect(item)"
        >
          <div class="result-conv">{{ item.conversationTitle || '对话' }}</div>
          <div class="result-content" v-html="highlightKeyword(item.content)"></div>
          <div class="result-meta">
            <span class="result-role">{{ item.role === 'user' ? '我' : 'AI' }}</span>
            <span class="result-time">{{ formatTime(item.createdAt) }}</span>
          </div>
        </div>

        <button
          v-if="results.length < total"
          class="load-more-btn"
          @click="loadMore"
          :disabled="loadingMore"
        >
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { chatAPI } from '../api/chat'
import type { SearchResult } from '../types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  select: [result: { conversationId: string; messageId: string }]
}>()

const searchInputRef = ref<HTMLInputElement | null>(null)
const keyword = ref('')
const results = ref<SearchResult[]>([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const noResults = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => searchInputRef.value?.focus())
  } else {
    clearSearch()
  }
})

function handleInput() {
  noResults.value = false
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!keyword.value.trim()) {
    results.value = []
    total.value = 0
    return
  }
  debounceTimer = setTimeout(doSearch, 400)
}

async function doSearch() {
  const q = keyword.value.trim()
  if (!q) return

  loading.value = true
  noResults.value = false
  try {
    const data = await chatAPI.conversations.searchMessages(q, { limit: 20, offset: 0 })
    results.value = data.messages
    total.value = data.total
    noResults.value = data.messages.length === 0
  } catch (e) {
    console.error('搜索失败:', e)
    results.value = []
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  loadingMore.value = true
  try {
    const data = await chatAPI.conversations.searchMessages(keyword.value.trim(), {
      limit: 20,
      offset: results.value.length,
    })
    results.value.push(...data.messages)
    total.value = data.total
  } catch (e) {
    console.error('加载更多失败:', e)
  } finally {
    loadingMore.value = false
  }
}

function highlightKeyword(text: string): string {
  if (!text || !keyword.value.trim()) return escapeHtml(text)
  const escaped = escapeHtml(text)
  // 截取关键词前后各 50 字符的摘要
  const kw = keyword.value.trim()
  const idx = text.toLowerCase().indexOf(kw.toLowerCase())
  let snippet = escaped
  if (idx >= 0 && text.length > 120) {
    const start = Math.max(0, idx - 50)
    const end = Math.min(text.length, idx + kw.length + 50)
    snippet = (start > 0 ? '...' : '') + escapeHtml(text.slice(start, end)) + (end < text.length ? '...' : '')
  }
  const regex = new RegExp(`(${escapeRegex(escapeHtml(kw))})`, 'gi')
  return snippet.replace(regex, '<mark>$1</mark>')
}

function escapeHtml(text: string): string {
  if (!text) return ''
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function handleSelect(item: SearchResult) {
  emit('select', {
    conversationId: item.conversationId,
    messageId: item.id,
  })
}

function clearSearch() {
  keyword.value = ''
  results.value = []
  total.value = 0
  noResults.value = false
}

function close() {
  clearSearch()
  emit('close')
}
</script>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f7f7f8;
}

.search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e5e5;
  background: white;
}

.search-input-wrapper {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 8px 30px 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  background: #f5f5f5;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: #4a90d9;
  background: white;
}

.clear-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  font-size: 16px;
  color: #999;
  cursor: pointer;
  padding: 2px 4px;
}

.close-btn {
  border: none;
  background: none;
  color: #4a90d9;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.results-count {
  padding: 4px 16px 8px;
  font-size: 12px;
  color: #999;
}

.search-loading,
.search-empty {
  padding: 40px 16px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.result-item {
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.15s;
}

.result-item:hover {
  background: #eef3fb;
}

.result-conv {
  font-size: 12px;
  color: #4a90d9;
  margin-bottom: 4px;
  font-weight: 500;
}

.result-content {
  font-size: 13px;
  line-height: 1.5;
  color: #333;
  word-break: break-word;
}

.result-content :deep(mark) {
  background: #fff3b0;
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
}

.result-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
  color: #aaa;
}

.result-role {
  color: #888;
}

.load-more-btn {
  display: block;
  width: calc(100% - 32px);
  margin: 8px 16px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #666;
  font-size: 13px;
  cursor: pointer;
}

.load-more-btn:hover:not(:disabled) {
  background: #f5f5f5;
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
