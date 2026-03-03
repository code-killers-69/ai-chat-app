<template>
    <div class="container">
        <HeaderBar :is-logged-in="isLoggedIn" :user="user" @show-login="$emit('showLogin')"
            @logout="$emit('logout')" />

        <!-- 消息列表 -->
        <div class="scrollArea" ref="scrollArea" @scroll="onScroll">
            <!-- 顶部加载更多 -->
            <div v-if="isLoadingOlder" class="loading-indicator">加载中...</div>
            <div v-else-if="hasMoreBefore" class="loading-indicator load-more-trigger">
                向上滚动加载更多
            </div>

            <div v-for="msg in messages" :key="msg.id"
                class="message-item baseAlign"
                :class="{ yourAlign: msg.role === 'you', myAlign: msg.role === 'me' }">
                <MessageBubble :message="msg" :content="msg.content" :is-streaming="msg.isStreaming" @image-loaded="onMessageImageLoaded" />
            </div>
        </div>

        <MessageInput :is-loading="isLoading" @send="handleSend" />
    </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, triggerRef, nextTick } from 'vue'
import HeaderBar from './HeaderBar.vue'
import MessageBubble from './MessageBubble.vue'
import MessageInput from './MessageInput.vue'
import { chatAPI } from '../api/chat'
import { Message } from '../models/Message'
import type { UserInfo, ServerMessage, PaginationInfo, PaginatedMessages } from '@chat-app/shared'

defineProps<{
    isLoggedIn: boolean
    user: UserInfo | null
}>()

const emit = defineEmits<{
  showLogin: []
  logout: []
  newConversationCreated: []
  cacheUpdated: [payload: { convId: string; messages: ServerMessage[]; pagination: PaginationInfo }]
}>()

// ========== 状态 ==========
const messages = shallowRef<Message[]>([])
const isLoading = ref(false)
const scrollArea = ref<HTMLDivElement | null>(null)

// 分页状态
const hasMoreBefore = ref(false)
const hasMoreAfter = ref(false)
const isLoadingOlder = ref(false)
const currentConversationId = ref<string | null>(null)
// 初始化期间禁止触发加载历史消息（scrollTop 为 0 会误触发）
let isInitializing = false

// ========== 滚动工具 ==========
function isNearBottom(threshold = 150) {
    if (!scrollArea.value) return true
    const { scrollTop, scrollHeight, clientHeight } = scrollArea.value
    return scrollHeight - scrollTop - clientHeight < threshold
}

function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const doScroll = () => {
        if (!scrollArea.value) return
        scrollArea.value.scrollTo({
            top: scrollArea.value.scrollHeight,
            left: 0,
            behavior,
        })
    }

    nextTick(doScroll)

    // instant 模式（初始加载/切换会话）：延迟兜底，等图片等异步内容撑开高度
    if (behavior === 'instant') {
        nextTick(() => nextTick(doScroll))
        setTimeout(doScroll, 100)
    }
}

// 滚动事件：加载更多
function onScroll() {
    if (!isInitializing && scrollArea.value && scrollArea.value.scrollTop < 50 && hasMoreBefore.value && !isLoadingOlder.value) {
        loadOlderMessages()
    }
}

// ========== 加载更早的消息 ==========
async function loadOlderMessages() {
    if (!currentConversationId.value || messages.value.length === 0) return
    isLoadingOlder.value = true

    // 记住当前第一个可见消息，加载完后恢复滚动位置
    const firstMsgEl = scrollArea.value?.querySelector('.message-item')
    const prevScrollHeight = scrollArea.value?.scrollHeight || 0

    try {
        const firstMsg = messages.value[0]
        const result = await chatAPI.conversations.getMessagesPaginated(
            currentConversationId.value,
            { limit: 20, before: firstMsg.id }
        )

        if (result.messages && result.messages.length > 0) {
            const olderMessages = result.messages.map(m => Message.fromServer(m))
            messages.value = [...olderMessages, ...messages.value]
            hasMoreBefore.value = result.pagination.hasMoreBefore

            // 恢复滚动位置：新内容插入顶部后，scrollHeight 增加了，补偿差值
            await nextTick()
            if (scrollArea.value) {
                const newScrollHeight = scrollArea.value.scrollHeight
                scrollArea.value.scrollTop += (newScrollHeight - prevScrollHeight)
            }

            // 同步更新 Sidebar 缓存，切换回来时不再重复加载
            emit('cacheUpdated', {
                convId: currentConversationId.value,
                messages: messages.value.map(m => ({
                    id: m.id,
                    content: m.content,
                    created_at: m.createdAt,
                    role: m.role === 'me' ? 'user' : 'assistant',
                    images: m.images,
                })),
                pagination: {
                    hasMoreBefore: hasMoreBefore.value,
                    hasMoreAfter: hasMoreAfter.value,
                },
            })
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
    if (isNearBottom()) {
        scrollToBottom()
    }
}

// ========== 发送消息 ==========
let chunkRAF: number | null = null

const handleSend = async ({ content, images }: { content: string; images: import('../models/Message').MessageImage[] }) => {
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
                // 使用 rAF 节流：每帧最多更新一次
                if (!chunkRAF) {
                    chunkRAF = requestAnimationFrame(() => {
                        chunkRAF = null
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
        aiMsg.setError((error as Error).message)
        triggerRef(messages)
        isLoading.value = false
    }
}

// ========== 消息加载（分页） ==========

/**
 * 初始加载会话消息（首次进入会话时调用）
 * @returns {object|null} 返回原始分页数据供缓存
 */
const initMessages = async (convId: string): Promise<PaginatedMessages | null> => {
    currentConversationId.value = convId
    isInitializing = true

    try {
        const result = await chatAPI.conversations.getMessagesPaginated(convId, { limit: 20 })
        messages.value = result.messages.map(m => Message.fromServer(m))
        hasMoreBefore.value = result.pagination.hasMoreBefore
        hasMoreAfter.value = result.pagination.hasMoreAfter

        await nextTick()
        scrollToBottom('instant')

        // scrollToBottom 的兜底 setTimeout 是 100ms，等它完成后再解除保护
        setTimeout(() => { isInitializing = false }, 150)

        return result
    } catch (e) {
        console.error('加载消息失败:', e)
        messages.value = []
        isInitializing = false
        return null
    }
}

/**
 * 从缓存加载消息
 */
const loadFromCache = (msgList: ServerMessage[], pagination: Partial<PaginationInfo> = {}) => {
    currentConversationId.value = chatAPI.conversationId
    isInitializing = true
    messages.value = msgList.map(m => Message.fromServer(m))
    hasMoreBefore.value = pagination.hasMoreBefore || false
    hasMoreAfter.value = pagination.hasMoreAfter || false

    nextTick(() => {
        scrollToBottom('instant')
        setTimeout(() => { isInitializing = false }, 150)
    })
}

const clearMessages = () => {
    messages.value = []
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
