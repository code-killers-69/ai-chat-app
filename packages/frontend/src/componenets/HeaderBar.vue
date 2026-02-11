<template>
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
</template>

<script setup>
defineProps({
  isLoggedIn: Boolean,
  user: Object,
})

defineEmits(['showLogin', 'logout'])
</script>

<style scoped>
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
</style>
