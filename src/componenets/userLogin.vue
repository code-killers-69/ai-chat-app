<template>
    <div class="userLogAndState">
        <div class="user-state" style="display: flex; position: absolute; right: 20px; gap: 20px;">
            <button class="login-btn" @click="showLoginModal = true;" v-if="!isLogin">Login</button>
            <button class="logout-btn" @click="handleLogout" v-if="isLogin">Logout</button>
            <div class="user-info" v-if="isLogin">
                <div class="user-name">{{ userInfoRef.username }}</div>
            </div>
        </div>
        <div class="user-log-sign" v-if="showLoginModal">
            <div class="register-container" v-if="showRegister">
                <input v-model="username" type="text" placeholder="请输入用户名">
                <input v-model="password" type="password" placeholder="请输入密码" autocomplete="new-password">
                <button @click="onRegister" :disabled="!isValid">REGISTER!</button>
                <button @click="showRegister = false">go to login</button>
            </div>
            <div class="login-container" v-else>
                <input v-model="username" type="text" placeholder="请输入用户名">
                <input v-model="password" type="password" placeholder="请输入密码">
                <button @click="onLogin">LOGIN!</button>
                <button @click="handelRegister">go to register</button>
            </div>
            <button class="exit-button" @click="showLoginModal = false">x</button>
        </div>
    </div>
</template>

<script setup>
import getFetch from '@/utils/getFetch';
import { computed, reactive, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';
import { useMessageStore } from '@/states/message';
import { useUserStore } from '@/states/user';
import { useConvoStore } from '@/states/conversation';

const userStore = useUserStore()
const messageStore = useMessageStore()
const convoStore = useConvoStore()

const { userInfoRef } = storeToRefs(userStore)
const { setToken, $userReset } = userStore
const { $messageReset } = messageStore
const { $convoReset } = convoStore

const showRegister = ref(false)
const showLoginModal = ref(false)
const isLogin = ref(false);
const username = ref('')
const password = ref('')

//  监听账户输入
const isValid = computed(() => {
    if (username.value.length > 2 && password.value.length > 5) {
        return true
    }
    else {
        return false
    }
})

//  点击注册
const handelRegister = () => {
    showRegister.value = true;
    username.value = ''
    password.value = ''
}

//  注册
const onRegister = async () => {
    const userInfoSign = await getFetch('/api/user/register', false, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
            username: username.value,
            password: password.value
        }
    });
    if (userInfoSign.success) {
        console.error("注册成功!");
        showRegister.value = false
    }
};

//  登录
const onLogin = async () => {
    const userInfo = await getFetch('/api/user/login', false, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
            username: username.value,
            password: password.value
        }
    })
    if (userInfo.success) {
        //  数据存放
        const { token, user } = userInfo.data;
        localStorage.setItem('token', token)
        localStorage.setItem('userInfo', JSON.stringify(user))
        userInfoRef.value = user
        setToken(token)
        //  UI更新
        showLoginModal.value = false;
        isLogin.value = true;
        window.location.reload()
    } else {
        alert('找不到账户')
        console.error('用户数据错误');
    }
}

//  刷新重新存值
const userInfoJSON = localStorage.getItem('userInfo')
const localToken = localStorage.getItem('token')
if (localToken && userInfoJSON) {
    userInfoRef.value = JSON.parse(userInfoJSON)
    setToken(localToken)
    isLogin.value = true
}

const handleLogout = async () => {
    //  数据处理和UI更新
    $userReset()
    $convoReset()
    $messageReset()
    isLogin.value = false;
}
</script>

<style scoped>
* {
    margin: 0;
    padding: 0;
}

.user-log-sign {
    background-color: black;
    width: 400px;
    height: 300px;
    border-radius: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    margin-top: 80vh;
}

.register-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.login-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.exit-button {
    width: 20px;
    height: 20px;
    background-color: white;
    position: absolute;
    right: 20px;
    color: red;
    top: 20px;
    display: flex;
    justify-content: center;
}

.login-btn {
    align-items: flex-end;
}

.logout-btn {
    opacity: 0.5;
    border: none;
    background-color: white;
    transition: all 0.5s ease;
}

.logout-btn:hover {
    opacity: 1;
}

.user-name {
    border: 1px solid black;
    border-radius: 20%;
    padding: 0 4px 0 4px;
}
</style>
