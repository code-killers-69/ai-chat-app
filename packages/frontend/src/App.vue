<template>
  <div class="app-wrapper">
    <Sidebar 
      ref="sidebarRef"
      :is-logged-in="isLoggedIn"
      @new-chat="handleNewChat"
      @conversation-loaded="handleConversationLoaded"
      @conversation-deleted="handleConversationDeleted"
    />
    
    <ChatArea 
      ref="chatAreaRef"
      :is-logged-in="isLoggedIn"
      :user="user"
      @show-login="showAuthModal = true"
      @logout="handleLogout"
      @new-conversation-created="handleNewConversationCreated"
    />
  </div>
  
  <AuthModal :show="showAuthModal" @close="showAuthModal = false" @success="handleLoginSuccess" />
</template>

<script setup>
import { ref } from 'vue'
import Sidebar from './componenets/Sidebar.vue'
import ChatArea from './componenets/ChatArea.vue'
import AuthModal from './componenets/AuthModal.vue'
import { chatAPI } from './api/chat.js'

// 认证状态
const showAuthModal = ref(false)
const isLoggedIn = ref(chatAPI.auth.isLoggedIn())
const user = ref(chatAPI.auth.getUser())

// 组件引用
const sidebarRef = ref(null)
const chatAreaRef = ref(null)

// 登录成功
const handleLoginSuccess = () => {
  isLoggedIn.value = true
  user.value = chatAPI.auth.getUser()
}

// 退出登录
const handleLogout = () => {
  chatAPI.auth.logout()
  chatAPI.startNewConversation()
  isLoggedIn.value = false
  user.value = null
  chatAreaRef.value?.clearMessages()
  sidebarRef.value?.reset()
}

// 新建会话
const handleNewChat = () => {
  chatAreaRef.value?.clearMessages()
}

// 会话加载完成
const handleConversationLoaded = (messages) => {
  chatAreaRef.value?.loadMessages(messages)
}

// 新会话创建后刷新侧边栏
const handleNewConversationCreated = () => {
  sidebarRef.value?.refreshAndSetCurrent()
}

// 会话删除后清空聊天区域（当删除的是最后一个会话时）
const handleConversationDeleted = () => {
  chatAreaRef.value?.clearMessages()
}
</script>

<style scoped>
.app-wrapper {
  display: flex;
  height: 100vh;
  width: 100%;
}
</style>
