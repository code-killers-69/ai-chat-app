<template>
    <div class="container">
        <!-- 头部 -->
        <div class="headBar">
            <p>Chat Bot</p>
            <div class="headActions">
                <button v-if="!isLoggedIn" @click="$emit('showLogin')" class="actionBtn loginBtn">登录</button>
                <div v-else class="userInfo">
                    <span class="username">{{ user?.nickname || user?.username }}</span>
                    <button @click="$emit('logout')" class="actionBtn" title="退出登录">退出</button>
                </div>
            </div>
        </div>

        <!-- 消息列表 -->
        <div class="scrollArea" ref="scrollArea">
            <div v-for="message in messages" :key="message.id" class="baseAlign"
                :class="{ yourAlign: message.role === 'you', myAlign: message.role === 'me' }">
                <div class="questionTank"
                    :class="{ yourStyle: message.role === 'you', myStyle: message.role === 'me' }">
                    <div class="articleArea">
                        <div v-if="message.role === 'you'" class="markdown-body"
                            v-html="renderMarkdown(message.content)"></div>
                        <div v-else class="user-message" v-html="escapeHtml(message.content)"></div>
                        <span v-if="message.isStreaming" class="cursor">|</span>
                    </div>
                    <ImageContainer v-for="(image, index) in message.images" :key="image.imageUrl || image.url"
                        :image-url="image.imageUrl || image.url" @onImageLoaded="onMessageImageLoaded(message.images)"
                        :enable-loading-animation="false" size='200px' style="margin: 5px 0;">
                    </ImageContainer>
                    <div class="timeTag">
                        <p>{{ message.time }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 输入区域 -->
        <div class="questionBar">
            <div class="imageContainers">
                <ImageContainer v-for="(image, index) in images" :key="image.imageUrl" :image-url="image.imageUrl"
                    @onImageLoaded="onPreviewImageLoaded" :enable-loading-animation="true" size='80px'
                    style="margin: 0 2px;" :enable-lazy-load="true" :enable-delete-btn="true"
                    @on-image-deleted="onImageDeleted(index)">
                </ImageContainer>
            </div>
            <div class="inputArea">
                <div ref="inputRef" class="inputMessage" contenteditable="true" :class="{ disabled: isLoading }"
                    @keyup.enter.exact="sendMessage" @paste="handlePaste" data-placeholder="请输入文本"></div>
                <input type="file" ref="fileInput" multiple accept="image/*" style="display: none;"
                    @change="handleFileChange">
                <Transition>
                    <button @click="fileInput.click()" class="addBtn" :disabled="isLoading">+</button>
                </Transition>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { marked } from 'marked'
import ImageContainer from './imageContainer.vue'
import { chatAPI } from '../api/chat.js'

// 配置 marked
marked.setOptions({
    breaks: true,
    gfm: true,
})

const props = defineProps({
    isLoggedIn: Boolean,
    user: Object
})

const emit = defineEmits(['showLogin', 'logout', 'newConversationCreated'])

// 消息列表
const messages = ref([])
const isLoading = ref(false)
const inputRef = ref(null)
const scrollArea = ref(null)
const fileInput = ref(null)
const images = ref([])

let msgIdCounter = 0
let previewImageCount = 0
let messageImageCount = 0

// 工具函数
const genMsgId = () => `msg_${Date.now()}_${++msgIdCounter}`

const getNow = () => {
    const date = new Date(Date.now())
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return { hours, minutes }
}

const formatTime = (date) => {
    const d = new Date(date)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const renderMarkdown = (content) => {
    if (!content) return ''
    return marked.parse(content)
}

const escapeHtml = (text) => {
    if (!text) return ''
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>')
}

const scrollToNewMessage = () => {
    nextTick(() => {
        if (scrollArea.value) {
            scrollArea.value.scrollTo({
                top: scrollArea.value.scrollHeight,
                left: 0,
                behavior: "smooth",
            })
        }
    })
}

// 发送消息
const sendMessage = async () => {
    if (!inputRef.value) return
    const content = inputRef.value.textContent.trim()
    if (content === '' && images.value.length === 0) return
    if (isLoading.value) return

    const now = getNow()
    const userMessage = content
    const userImages = [...images.value]

    inputRef.value.textContent = ''
    images.value = []

    // 添加用户消息
    const userMsgId = genMsgId()
    messages.value.push({
        id: userMsgId,
        content: userMessage,
        time: `${now.hours}:${now.minutes}`,
        role: 'me',
        images: userImages
    })

    scrollToNewMessage()

    // 添加 AI 响应占位
    const aiMsgId = genMsgId()
    const aiNow = getNow()
    messages.value.push({
        id: aiMsgId,
        content: '',
        time: `${aiNow.hours}:${aiNow.minutes}`,
        role: 'you',
        isStreaming: true
    })

    const findAiMessage = () => messages.value.find(m => m.id === aiMsgId)
    const isNewConversation = !chatAPI.conversationId

    isLoading.value = true

    try {
        await chatAPI.streamMessage({
            message: userMessage,
            images: userImages,
            onChunk: (chunk) => {
                const ai = findAiMessage()
                if (ai) {
                    ai.content = ai.content + chunk
                }
                scrollToNewMessage()
            },
            onComplete: () => {
                const ai = findAiMessage()
                if (ai) {
                    ai.isStreaming = false
                }
                isLoading.value = false
                scrollToNewMessage()
                // 新会话创建后通知父组件
                if (isNewConversation) {
                    emit('newConversationCreated')
                }
            },
            onError: (error) => {
                const ai = findAiMessage()
                if (ai) {
                    ai.content = `抱歉，发生错误：${error.message}`
                    ai.isStreaming = false
                }
                isLoading.value = false
            }
        })
    } catch (error) {
        const ai = findAiMessage()
        if (ai) {
            ai.content = `抱歉，发生错误：${error.message}`
            ai.isStreaming = false
        }
        isLoading.value = false
    }
}

// 图片处理
const onPreviewImageLoaded = () => {
    if (++previewImageCount === images.value.length) {
        previewImageCount = 0
    }
}

const onMessageImageLoaded = (imgs) => {
    if (++messageImageCount === imgs.length) {
        messageImageCount = 0
        scrollToNewMessage()
    }
}

const handleFileChange = (e) => {
    const files = e.target.files
    if (files.length === 0) return
    for (const file of files) {
        images.value.push({ imageUrl: URL.createObjectURL(file) })
    }
}

const handlePaste = (e) => {
    const files = e.clipboardData.files
    if (files.length === 0) return
    for (const file of files) {
        if (file.type.startsWith('image/')) {
            images.value.push({ imageUrl: URL.createObjectURL(file) })
            e.preventDefault()
        }
    }
}

const onImageDeleted = (index) => {
    images.value.splice(index, 1)
}

// 加载会话消息（供外部调用）
const loadMessages = (msgList) => {
    messages.value = msgList.map(m => ({
        id: m.id,
        content: m.content,
        time: formatTime(m.created_at),
        role: m.role === 'user' ? 'me' : 'you',
        images: m.images || []
    }))
    scrollToNewMessage()
}

// 清空消息
const clearMessages = () => {
    messages.value = []
}

// 暴露方法给父组件
defineExpose({
    loadMessages,
    clearMessages
})
</script>

<style scoped>
.container {
    position: relative;
    height: 100vh;
    flex: 1;
    min-width: 0;
    padding: 0 0 40px 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: hidden;
}

.headBar {
    width: 100%;
    height: 60px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    position: relative;
    flex-shrink: 0;
}

.headActions {
    position: absolute;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.actionBtn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1em;
    opacity: 0.6;
    transition: opacity 0.2s;
}

.actionBtn:hover {
    opacity: 1;
}

.loginBtn {
    padding: 6px 12px;
    background: var(--primary-color);
    color: white;
    border-radius: 6px;
    opacity: 1;
}

.loginBtn:hover {
    background: var(--primary-hover);
}

.userInfo {
    display: flex;
    align-items: center;
    gap: 8px;
}

.username {
    font-size: 0.9em;
    color: #666;
    font-weight: normal;
}

.scrollArea {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: none;
}

.baseAlign {
    display: flex;
    flex-direction: column;
}

.yourAlign {
    align-items: flex-start;
}

.myAlign {
    align-items: flex-end;
}

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

.questionBar {
    display: flex;
    flex-direction: column;
    margin: 0 auto;
    width: 80%;
    background-color: whitesmoke;
    padding: 20px;
    border-radius: 15px;
    flex-shrink: 0;
    margin-bottom: 20px;
}

.imageContainers {
    display: flex;
    width: 100%;
    overflow: scroll;
    scrollbar-width: none;
}

.inputArea {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
}

.inputMessage {
    width: 100%;
    outline: none;
    border: none;
    background-color: whitesmoke;
    min-height: 24px;
    max-height: 150px;
    overflow-y: auto;
    line-height: 1.5;
    word-break: break-word;
}

.inputMessage:empty::before {
    content: attr(data-placeholder);
    color: #999;
}

.inputMessage.disabled {
    opacity: 0.6;
    pointer-events: none;
}

.addBtn {
    height: 30px;
    width: 30px;
    flex-shrink: 0;
    background-color: rgb(223, 223, 223);
    border: none;
    border-radius: 5px;
    font-weight: 700;
}

.addBtn:hover {
    background-color: rgb(192, 192, 192);
}

.addBtn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.cursor {
    animation: blink 1s infinite;
    margin-left: 2px;
}

@keyframes blink {

    0%,
    50% {
        opacity: 1;
    }

    51%,
    100% {
        opacity: 0;
    }
}

.v-enter-active {
    transition: opacity 1s ease;
}

.v-leave-active {
    transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
    opacity: 0;
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
