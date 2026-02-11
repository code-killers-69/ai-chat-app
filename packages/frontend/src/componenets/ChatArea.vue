<template>
    <div class="container">
        <HeaderBar :is-logged-in="isLoggedIn" :user="user" @show-login="$emit('showLogin')"
            @logout="$emit('logout')" />

        <!-- 消息列表（虚拟滚动） -->
        <div class="scrollArea" ref="scrollArea" @scroll="onScroll">
            <!-- 顶部加载更多 -->
            <div v-if="isLoadingOlder" class="loading-indicator">加载中...</div>
            <div v-else-if="hasMoreBefore" class="loading-indicator load-more-trigger">
                向上滚动加载更多
            </div>

            <!-- 虚拟列表容器 -->
            <div class="virtual-list-container" :style="{ height: totalHeight + 'px', position: 'relative' }">
                <div v-for="item in visibleItems" :key="item.data.id" :data-virtual-id="item.data.id"
                    class="virtual-item baseAlign"
                    :class="{ yourAlign: item.data.role === 'you', myAlign: item.data.role === 'me' }"
                    :style="{ position: 'absolute', top: item.offset + 'px', width: '100%' }">
                    <MessageBubble :message="item.data" :content="item.data.content" :is-streaming="item.data.isStreaming" @image-loaded="onMessageImageLoaded" />
                </div>
            </div>
        </div>

        <MessageInput :is-loading="isLoading" @send="handleSend" />
    </div>
</template>

<script setup>
import { ref, shallowRef, triggerRef, nextTick } from 'vue'
import HeaderBar from './HeaderBar.vue'
import MessageBubble from './MessageBubble.vue'
import MessageInput from './MessageInput.vue'
import { chatAPI } from '../api/chat.js'
import { Message } from '../models/Message.js'
import { useVirtualList } from '../composables/useVirtualList.js'

defineProps({
    isLoggedIn: Boolean,
    user: Object,
})

const emit = defineEmits(['showLogin', 'logout', 'newConversationCreated'])

// ========== 状态 ==========
const messages = shallowRef([])
const isLoading = ref(false)
const scrollArea = ref(null)

// 分页状态
const hasMoreBefore = ref(false)
const hasMoreAfter = ref(false)
const isLoadingOlder = ref(false)
const currentConversationId = ref(null)

// ========== 虚拟列表 ==========
const {
    visibleItems,
    totalHeight,
    onScroll: virtualOnScroll,
    scrollToBottom,
    isNearBottom,
    anchorAfterPrepend,
    observeVisibleItems,
    clearHeightCache,
    forceUpdate,
} = useVirtualList({
    items: messages,
    scrollContainer: scrollArea,
})

// 滚动事件：虚拟列表 + 加载更多
function onScroll() {
    virtualOnScroll()
    if (scrollArea.value && scrollArea.value.scrollTop < 50 && hasMoreBefore.value && !isLoadingOlder.value) {
        loadOlderMessages()
    }
}

// ========== 加载更早的消息 ==========
async function loadOlderMessages() {
    if (!currentConversationId.value || messages.value.length === 0) return
    isLoadingOlder.value = true

    try {
        const firstMsg = messages.value[0]
        const result = await chatAPI.conversations.getMessagesPaginated(
            currentConversationId.value,
            { limit: 20, before: firstMsg.id }
        )

        if (result.messages && result.messages.length > 0) {
            const olderMessages = result.messages.map(m => Message.fromServer(m))
            const prependCount = olderMessages.length
            messages.value = [...olderMessages, ...messages.value]
            hasMoreBefore.value = result.pagination.hasMoreBefore

            // 统一由虚拟列表锚定处理滚动位置
            anchorAfterPrepend(prependCount)

            await nextTick()
            observeVisibleItems()
        } else {
            hasMoreBefore.value = false
        }
    } catch (e) {
        console.error('加载历史消息失败:', e)
    } finally {
        isLoadingOlder.value = false
    }
}

// ========== 图片加载回调 ==========
const onMessageImageLoaded = () => {
    forceUpdate()
    if (isNearBottom()) {
        scrollToBottom()
    }
}

// ========== 发送消息 ==========
let chunkRAF = null

const handleSend = async ({ content, images }) => {
    if (isLoading.value) return

    const userMsg = Message.createUserMessage({ content, images })
    messages.value.push(userMsg)
    triggerRef(messages)
    scrollToBottom()

    const aiMsg = Message.createStreamingPlaceholder()
    messages.value.push(aiMsg)
    triggerRef(messages)

    const isNewConversation = !chatAPI.conversationId
    isLoading.value = true

    try {
        await chatAPI.streamMessage({
            message: content,
            images,
            onChunk: (chunk) => {
                aiMsg.appendContent(chunk)
                triggerRef(messages)
                // 使用 rAF 节流：每帧最多更新一次，避免高频触发抖动
                if (!chunkRAF) {
                    chunkRAF = requestAnimationFrame(() => {
                        chunkRAF = null
                        forceUpdate()
                        if (isNearBottom()) scrollToBottom()
                    })
                }
            },
            onComplete: () => {
                // 取消未执行的 chunk 更新
                if (chunkRAF) {
                    cancelAnimationFrame(chunkRAF)
                    chunkRAF = null
                }
                aiMsg.finishStreaming()
                triggerRef(messages)
                forceUpdate()
                isLoading.value = false
                if (isNearBottom()) scrollToBottom()
                if (isNewConversation) {
                    emit('newConversationCreated')
                }
            },
            onError: (error) => {
                if (chunkRAF) {
                    cancelAnimationFrame(chunkRAF)
                    chunkRAF = null
                }
                aiMsg.setError(error.message)
                triggerRef(messages)
                isLoading.value = false
            }
        })
    } catch (error) {
        if (chunkRAF) {
            cancelAnimationFrame(chunkRAF)
            chunkRAF = null
        }
        aiMsg.setError(error.message)
        triggerRef(messages)
        isLoading.value = false
    }
}

// ========== 消息加载（分页） ==========

/**
 * 初始加载会话消息（首次进入会话时调用）
 * @returns {object|null} 返回原始分页数据供缓存
 */
const initMessages = async (convId) => {
    currentConversationId.value = convId
    clearHeightCache()

    try {
        const result = await chatAPI.conversations.getMessagesPaginated(convId, { limit: 20 })
        messages.value = result.messages.map(m => Message.fromServer(m))
        hasMoreBefore.value = result.pagination.hasMoreBefore
        hasMoreAfter.value = result.pagination.hasMoreAfter

        await nextTick()
        observeVisibleItems()
        scrollToBottom('instant')

        return result
    } catch (e) {
        console.error('加载消息失败:', e)
        messages.value = []
        return null
    }
}

/**
 * 从缓存加载消息
 */
const loadFromCache = (msgList, pagination = {}) => {
    currentConversationId.value = chatAPI.conversationId
    clearHeightCache()
    messages.value = msgList.map(m => Message.fromServer(m))
    hasMoreBefore.value = pagination.hasMoreBefore || false
    hasMoreAfter.value = pagination.hasMoreAfter || false

    nextTick(() => {
        observeVisibleItems()
        scrollToBottom('instant')
    })
}

const clearMessages = () => {
    messages.value = []
    clearHeightCache()
    hasMoreBefore.value = false
    hasMoreAfter.value = false
    currentConversationId.value = null
}

defineExpose({
    initMessages,
    loadFromCache,
    clearMessages,
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

.scrollArea {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: none;
    position: relative;
}

.virtual-list-container {
    width: 100%;
}

.virtual-item {
    box-sizing: border-box;
}

.loading-indicator {
    text-align: center;
    padding: 12px;
    color: #999;
    font-size: 13px;
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
</style>
