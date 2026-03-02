<template>
  <div class="headBar">
    <!-- 模型选择下拉框 -->
    <div class="model-selector" ref="selectorRef">
      <button class="model-btn" @click="toggleDropdown">
        <img v-if="currentModel" :src="currentModel.icon" class="model-icon" alt="" />
        <span class="model-name">{{ currentModel ? currentModel.name : '选择模型' }}</span>
        <span class="arrow" :class="{ open: showDropdown }">&#9662;</span>
      </button>
      <Transition name="dropdown">
        <div v-if="showDropdown" class="model-dropdown">
          <div
            v-for="m in models"
            :key="m.id"
            class="model-option"
            :class="{ active: m.id === selectedModelId }"
            @click="selectModel(m)"
          >
            <img :src="m.icon" class="model-icon" alt="" />
            <div class="model-info">
              <div class="model-option-name">
                {{ m.name }}
                <span v-if="m.free" class="free-badge">免费</span>
              </div>
              <div class="model-desc">{{ m.description }}</div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <div class="headActions">
      <button v-if="!isLoggedIn" @click="$emit('showLogin')" class="actionBtn loginBtn">登录</button>
      <div v-else class="userInfo">
        <span class="username">{{ user?.nickname || user?.username }}</span>
        <button @click="$emit('logout')" class="actionBtn" title="退出登录">退出</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { chatAPI } from '../api/chat'
import type { ModelInfo, UserInfo } from '../types'

defineProps<{
  isLoggedIn: boolean
  user: UserInfo | null
}>()

const emit = defineEmits<{
  showLogin: []
  logout: []
  modelChange: [modelId: string]
}>()

const models = ref<ModelInfo[]>([])
const selectedModelId = ref<string | null>(null)
const currentModel = ref<ModelInfo | null>(null)
const showDropdown = ref(false)
const selectorRef = ref<HTMLDivElement | null>(null)

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const selectModel = (m: ModelInfo) => {
  selectedModelId.value = m.id
  currentModel.value = m
  showDropdown.value = false
  chatAPI.setModel(m.id)
  emit('modelChange', m.id)
}

// 点击外部关闭
const handleClickOutside = (e: MouseEvent) => {
  if (selectorRef.value && !selectorRef.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  try {
    const list = await chatAPI.getModels()
    models.value = list
    // 默认选中第一个（免费模型）
    if (list.length > 0) {
      const defaultModel = list[0]
      selectedModelId.value = defaultModel.id
      currentModel.value = defaultModel
      chatAPI.setModel(defaultModel.id)
    }
  } catch (e) {
    console.error('获取模型列表失败:', e)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
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

/* 模型选择器 */
.model-selector {
  position: relative;
}

.model-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  transition: all 0.2s;
}

.model-btn:hover {
  background: #ebebeb;
  border-color: #ccc;
}

.model-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: contain;
}

.model-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  font-size: 10px;
  transition: transform 0.2s;
  color: #999;
}

.arrow.open {
  transform: rotate(180deg);
}

.model-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  min-width: 280px;
  max-height: 360px;
  overflow-y: auto;
  z-index: 1000;
  padding: 6px;
}

.model-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.model-option:hover {
  background: #f5f5f5;
}

.model-option.active {
  background: #e8f0fe;
}

.model-option .model-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-option-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 6px;
}

.free-badge {
  font-size: 11px;
  font-weight: 500;
  background: #e6f7e6;
  color: #2e7d32;
  padding: 1px 6px;
  border-radius: 4px;
}

.model-desc {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
  font-weight: normal;
}

/* 下拉动画 */
.dropdown-enter-active {
  transition: all 0.2s ease;
}
.dropdown-leave-active {
  transition: all 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}
.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
