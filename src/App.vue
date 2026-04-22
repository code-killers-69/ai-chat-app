<template>
  <div class="container">
    <div class="sidebar" :class="{ 'is-collapsed': !isConvoVisible }">
      <div class="toggle-btn-wrapper">
        <button class="toggle-convo-btn" @click="isConvoVisible = !isConvoVisible">
          ☰
        </button>
      </div>
      <Transition name="fade">
        <convoTab class="convo-tab" v-show="isConvoVisible"></convoTab>
      </Transition>
    </div>
    <chatTab class="chat-tab">
    </chatTab>
  </div>
</template>

<script setup>
import chatTab from './tabs/chatTab.vue';
import convoTab from './tabs/convoTab.vue';
import { onMounted, ref } from 'vue';
import { useConvoStore } from './states/conversation';

const convoStore = useConvoStore()
const { convoInit } = convoStore

const isConvoVisible = ref(true)

// 初始化会话列表
onMounted(convoInit)

</script>

<style scoped>
.container {
  position: relative;
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  position: relative;
  width: 16.666vw;
  flex-shrink: 0;
  height: 100%;
  background-color: white;
  box-shadow: 2px 0 10px rgba(0,0,0,0.05);
  z-index: 999;
  transition: width 0.3s ease;
  overflow: hidden;
}

.sidebar.is-collapsed {
  width: 80px;
}

.toggle-btn-wrapper {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  transition: left 0.3s ease, transform 0.3s ease;
}

.sidebar.is-collapsed .toggle-btn-wrapper {
  left: 50%;
  transform: translateX(-50%);
}

.toggle-convo-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #333;
  transition: transform 0.3s;
  display: block;
}

.toggle-convo-btn:hover {
  transform: scale(1.1);
}

.convo-tab {
  width: 16.666vw;
  height: 100%;
}

.chat-tab {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 当整个页面的宽度小于 768px 时隐藏侧边栏 */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}
</style>
