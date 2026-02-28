<template>
  <div class="auth-modal" v-if="show">
    <div class="auth-backdrop" @click="$emit('close')"></div>
    <div class="auth-container">
      <h2>{{ isLogin ? '登录' : '注册' }}</h2>
      
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <input 
            v-model="username" 
            type="text" 
            placeholder="用户名" 
            required
            minlength="3"
            maxlength="50"
          />
        </div>
        
        <div class="form-group" v-if="!isLogin">
          <input 
            v-model="nickname" 
            type="text" 
            placeholder="昵称（可选）"
            maxlength="100"
          />
        </div>
        
        <div class="form-group">
          <input 
            v-model="password" 
            type="password" 
            placeholder="密码" 
            required
            minlength="6"
          />
        </div>
        
        <div class="form-group" v-if="!isLogin">
          <input 
            v-model="confirmPassword" 
            type="password" 
            placeholder="确认密码" 
            required
          />
        </div>
        
        <p v-if="error" class="error">{{ error }}</p>
        
        <button type="submit" :disabled="loading">
          {{ loading ? '处理中...' : (isLogin ? '登录' : '注册') }}
        </button>
      </form>
      
      <p class="switch-mode">
        {{ isLogin ? '没有账号？' : '已有账号？' }}
        <a href="#" @click.prevent="toggleMode">
          {{ isLogin ? '去注册' : '去登录' }}
        </a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { chatAPI } from '../api/chat.js';

const props = defineProps({
  show: Boolean
});

const emit = defineEmits(['close', 'success']);

const isLogin = ref(true);
const username = ref('');
const nickname = ref('');
const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const loading = ref(false);

const toggleMode = () => {
  isLogin.value = !isLogin.value;
  error.value = '';
};

const handleSubmit = async () => {
  error.value = '';
  
  if (!isLogin.value && password.value !== confirmPassword.value) {
    error.value = '两次密码输入不一致';
    return;
  }
  
  loading.value = true;
  
  try {
    if (isLogin.value) {
      await chatAPI.auth.login(username.value, password.value);
    } else {
      await chatAPI.auth.register(username.value, password.value, nickname.value);
      await chatAPI.auth.login(username.value, password.value);
    }
    
    emit('success');
    emit('close');
    
    // 重置表单
    username.value = '';
    nickname.value = '';
    password.value = '';
    confirmPassword.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.auth-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.auth-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.auth-container {
  position: relative;
  background: white;
  padding: 30px;
  border-radius: 12px;
  width: 320px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

h2 {
  text-align: center;
  margin-bottom: 20px;
  color: #333;
}

.form-group {
  margin-bottom: 15px;
}

input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: var(--primary-color);
}

button {
  width: 100%;
  padding: 12px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: var(--primary-hover);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #e74c3c;
  font-size: 13px;
  margin-bottom: 10px;
  text-align: center;
}

.switch-mode {
  text-align: center;
  margin-top: 15px;
  font-size: 13px;
  color: #666;
}

.switch-mode a {
  color: var(--primary-color);
  text-decoration: none;
}

.switch-mode a:hover {
  text-decoration: underline;
  color: var(--primary-hover);
}
</style>
