<template>
  <div class="container">
    <convoTab class="convo-tab"></convoTab>
    <chatTab>
    </chatTab>
  </div>
</template>

<script setup>
import chatTab from './tabs/chatTab.vue';
import convoTab from './tabs/convoTab.vue';
import { onMounted } from 'vue';
import { useConvoStore } from './states/conversation';

const convoStore = useConvoStore()
const { convoInit } = convoStore

// 初始化会话列表
onMounted(convoInit)

</script>

<style scoped>
.container {
  position: relative;
  display: flex;
}

.convo-tab {
  position: absolute;
  left: 0;
  top: 0;
}
</style>
