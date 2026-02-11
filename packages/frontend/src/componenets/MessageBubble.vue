<template>
  <div class="questionTank" :class="[message.role === 'you' ? 'yourStyle' : 'myStyle']">
    <div class="articleArea">
      <div v-if="message.role === 'you'" class="markdown-body" v-html="renderMarkdown(message.content)"></div>
      <div v-else class="user-message" v-html="escapeHtml(message.content)"></div>
      <span v-if="message.isStreaming" class="cursor">|</span>
    </div>
    <ImageContainer
      v-for="image in message.images"
      :key="image.imageUrl || image.url"
      :image-url="image.imageUrl || image.url"
      @onImageLoaded="$emit('imageLoaded')"
      :enable-loading-animation="true"
      size="200px"
      style="margin: 5px 0;"
    />
    <div class="timeTag">
      <p>{{ message.time }}</p>
    </div>
  </div>
</template>

<script setup>
import ImageContainer from './imageContainer.vue'
import { useMarkdown } from '../composables/useMarkdown.js'

defineProps({
  message: {
    type: Object,
    required: true,
  },
})

defineEmits(['imageLoaded'])

const { renderMarkdown, escapeHtml } = useMarkdown()
</script>

<style scoped>
.questionTank {
  padding: 10px;
  margin-bottom: 20px;
  background-color: white;
  border-radius: 10px;
  width: fit-content;
  max-width: 70%;
}

.yourStyle {
  background-color: #e9eef6;
  margin-left: 40px;
}

.myStyle {
  background-color: var(--primary-color);
  margin-right: 40px;
}

.articleArea {
  margin-bottom: 5px;
  word-break: break-word;
}

.timeTag {
  font-size: 0.1em;
}

.cursor {
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Markdown 样式 */
.markdown-body {
  line-height: 1.6;
}

.user-message {
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.markdown-body :deep(p) {
  margin: 0.5em 0;
}

.markdown-body :deep(p:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(code) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
}

.markdown-body :deep(pre) {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5em 0;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.markdown-body :deep(li) {
  margin: 0.25em 0;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid #ddd;
  padding-left: 1em;
  margin: 0.5em 0;
  color: #666;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 0.5em 0;
  font-weight: 600;
}

.markdown-body :deep(a) {
  color: #0066cc;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #ddd;
  padding: 8px;
}

.markdown-body :deep(th) {
  background-color: #f5f5f5;
}
</style>
