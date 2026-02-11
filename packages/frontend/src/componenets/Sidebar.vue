<template>
  <div class="sidebar" v-if="isLoggedIn">
    <div class="sidebar-header">
      <button @click="handleNewChat" class="newChatBtn">+ 新会话</button>
    </div>
    <div class="conversation-list">
      <div 
        v-for="conv in conversationList" 
        :key="conv.id" 
        class="conversation-item"
        :class="{ active: currentConversationId === conv.id }"
        @click="handleSwitch(conv.id)"
        @mousedown="startLongPress(conv)"
        @mouseup="cancelLongPress"
        @mouseleave="cancelLongPress"
        @touchstart="startLongPress(conv)"
        @touchend="cancelLongPress"
      >
        <input
          v-if="editingId === conv.id"
          ref="editInputRef"
          v-model="editingTitle"
          class="edit-input"
          @click.stop
          @blur="finishEdit(conv)"
          @keyup.enter="finishEdit(conv)"
          @keyup.esc="cancelEdit"
        />
        <span v-else class="conv-title">{{ conv.title || '新对话' }}</span>
        <button 
          v-if="editingId !== conv.id"
          class="delete-btn" 
          @click.stop="handleDelete(conv.id)"
          title="删除会话"
        >×</button>
      </div>
      <div v-if="conversationList.length === 0" class="no-conversations">
        暂无会话记录
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { chatAPI } from '../api/chat.js'
import { Conversation } from '../models/Conversation.js'

const props = defineProps({
  isLoggedIn: Boolean
})

const emit = defineEmits(['newChat', 'switchConversation', 'conversationInit', 'conversationCached', 'conversationDeleted'])

const conversationList = ref([])
const currentConversationId = ref(null)

// 消息缓存：key 为 conversationId，value 为 { updatedAt, messages, pagination }
const messagesCache = new Map()

// 临时保存最近一次 getConversationInfo 拿到的 updatedAt
let lastFetchedUpdatedAt = ''

// 编辑状态
const editingId = ref(null)
const editingTitle = ref('')
const editInputRef = ref(null)
let longPressTimer = null
const LONG_PRESS_DURATION = 500 // 长按时间 500ms

// 长按开始
const startLongPress = (conv) => {
  longPressTimer = setTimeout(() => {
    startEdit(conv)
  }, LONG_PRESS_DURATION)
}

// 取消长按
const cancelLongPress = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

// 开始编辑
const startEdit = (conv) => {
  editingId.value = conv.id
  editingTitle.value = conv.title || ''
  nextTick(() => {
    editInputRef.value?.[0]?.focus()
    editInputRef.value?.[0]?.select()
  })
}

// 完成编辑
const finishEdit = async (conv) => {
  const newTitle = editingTitle.value.trim()
  if (newTitle && newTitle !== conv.title) {
    try {
      await chatAPI.conversations.updateTitle(conv.id, newTitle)
      conv.title = newTitle
    } catch (e) {
      console.error('更新标题失败:', e)
    }
  }
  editingId.value = null
  editingTitle.value = ''
}

// 取消编辑
const cancelEdit = () => {
  editingId.value = null
  editingTitle.value = ''
}

// 加载会话列表
const loadConversationList = async () => {
  if (!props.isLoggedIn) return
  try {
    const rawList = await chatAPI.conversations.getConversations()
    conversationList.value = rawList.map(conv => Conversation.fromServer(conv))
  } catch (e) {
    console.error('加载会话列表失败:', e)
  }
}

// 加载指定会话（带缓存对比）
const loadConversation = async (convId) => {
  try {
    // 轻量请求：只拉取该会话的元信息（不含消息）
    const convInfo = await chatAPI.conversations.getConversationInfo(convId)
    if (!convInfo) return

    const serverUpdatedAt = convInfo.updated_at

    // 检查缓存是否命中：updatedAt 相同则直接使用缓存
    const cached = messagesCache.get(convId)
    if (cached && serverUpdatedAt && cached.updatedAt === serverUpdatedAt) {
      chatAPI.setConversation(convId)
      currentConversationId.value = convId
      emit('conversationCached', { messages: cached.messages, pagination: cached.pagination })
      return
    }

    // 缓存未命中或 updatedAt 不同，通知 ChatArea 用分页接口加载
    chatAPI.setConversation(convId)
    currentConversationId.value = convId
    lastFetchedUpdatedAt = serverUpdatedAt
    emit('conversationInit', convId)
  } catch (e) {
    console.error('加载会话失败:', e)
  }
}

// 加载最近会话
const loadLatestConversation = async () => {
  if (!props.isLoggedIn) return
  await loadConversationList()
  if (conversationList.value.length > 0) {
    await loadConversation(conversationList.value[0].id)
  }
}

// 切换会话
const handleSwitch = async (convId) => {
  if (editingId.value) return // 编辑中不切换
  if (convId === currentConversationId.value) return

  await loadConversation(convId)
  emit('switchConversation', convId)
}

// 删除会话
const handleDelete = async (convId) => {
  try {
    await chatAPI.conversations.deleteConversation(convId)
    
    // 从列表中移除
    const index = conversationList.value.findIndex(c => c.id === convId)
    if (index !== -1) {
      conversationList.value.splice(index, 1)
    }

    // 清除缓存
    messagesCache.delete(convId)
    
    // 如果删除的是当前会话
    if (convId === currentConversationId.value) {
      chatAPI.startNewConversation()
      currentConversationId.value = null
      
      // 如果还有其他会话，加载第一个
      if (conversationList.value.length > 0) {
        await loadConversation(conversationList.value[0].id)
      } else {
        emit('conversationDeleted')
      }
    }
  } catch (e) {
    console.error('删除会话失败:', e)
  }
}

// 新建会话
const handleNewChat = () => {
  chatAPI.startNewConversation()
  currentConversationId.value = null
  emit('newChat')
}

// 刷新列表并设置当前会话（供外部调用）
const refreshAndSetCurrent = async () => {
  await loadConversationList()
  if (!currentConversationId.value && chatAPI.conversationId) {
    currentConversationId.value = chatAPI.conversationId
  }
  // 当前会话有新消息，清除其缓存以便下次切换回来时重新拉取
  if (currentConversationId.value) {
    messagesCache.delete(currentConversationId.value)
  }
}

// 更新消息缓存（供外部在分页加载完成后调用）
const updateMessagesCache = (convId, data) => {
  messagesCache.set(convId, {
    updatedAt: lastFetchedUpdatedAt,
    messages: data.messages,
    pagination: data.pagination,
  })
}

// 重置状态
const reset = () => {
  conversationList.value = []
  currentConversationId.value = null
  editingId.value = null
  messagesCache.clear()
}

// 监听登录状态变化
watch(() => props.isLoggedIn, (newVal) => {
  if (newVal) {
    loadLatestConversation()
  } else {
    reset()
  }
})

onMounted(() => {
  if (props.isLoggedIn) {
    loadLatestConversation()
  }
})

// 暴露方法给父组件
defineExpose({
  refreshAndSetCurrent,
  updateMessagesCache,
  reset,
  loadConversationList
})
</script>

<style scoped>
.sidebar {
  width: 240px;
  background: #f5f5f5;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.newChatBtn {
  width: 100%;
  padding: 10px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.newChatBtn:hover {
  background: var(--primary-hover);
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.conversation-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  user-select: none;
}

.conversation-item:hover {
  background: #e8e8e8;
}

.conversation-item.active {
  background: #d9d9d9;
}

.conv-title {
  font-size: 14px;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-input {
  flex: 1;
  font-size: 14px;
  padding: 4px 8px;
  border: 1px solid var(--primary-color);
  border-radius: 4px;
  outline: none;
  background: white;
}

.edit-input:focus {
  border-color: var(--primary-hover);
  box-shadow: 0 0 0 2px rgba(179, 127, 235, 0.2);
}

.delete-btn {
  display: none;
  width: 20px;
  height: 20px;
  border: none;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: #666;
  flex-shrink: 0;
  margin-left: 8px;
}

.conversation-item:hover .delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: rgba(255, 77, 79, 0.2);
  color: #ff4d4f;
}

.no-conversations {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 14px;
}
</style>
