<template>
    <div class="user-modal">
        <div class="sign-container" v-if="showSignUp">
            <input v-model="username" id="username" type="text" placeholder="请输入用户名">
            <input v-model="password" id="password" type="text" placeholder="请输入密码">
            <button @click="userRegister">REGISTER!</button>
            <button @click="showSignUp = false">go to login</button>
        </div>
        <div class="login-container" v-else>
            <input v-model="username" type="text" placeholder="请输入用户名">
            <input v-model="password" type="text" placeholder="请输入密码">
            <button @click="userLogin">LOGIN!</button>
            <button @click="showSignUp = true">go to register</button>
        </div>
        <button class="exit-button" @click="exit">x</button>
    </div>
</template>

<script setup>
import { setToken, userInfoRef } from '@/states/user';
import { ref } from 'vue';
const showSignUp = ref(false)

const username = ref('')
const password = ref('')

const emit = defineEmits(['onLogin', 'exit'])

const getUserFetch = async (url) => {
    const response = await fetch(`http://www.dolmo.top:3001/api${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: username.value,
            password: password.value
        })
    });
    return response
}

const exit = () => {
    emit('exit')
}

const userRegister = async () => {
    const response = await getUserFetch('/user/register');
    const userInfoSign = await response.json();
    if (userInfoSign.success) {
        console.error("注册成功!");
        showSignUp.value = false
    }
};

const userLogin = async () => {
    const response = await getUserFetch('/user/login')
    const userInfo = await response.json();
    if (userInfo.success) {
        emit('onLogin')
        console.error("登录成功!");
        const { token, user } = userInfo.data;
        localStorage.setItem('token', token)
        localStorage.setItem('userInfo', JSON.stringify(user))
        userInfoRef.value = user
        setToken(token)
    } else {
        console.error('错误');
    }
}
</script>

<style scoped>
* {
    margin: 0;
    padding: 0;
}

.user-modal {
    background-color: black;
    width: 400px;
    height: 300px;
    border-radius: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.sign-container {
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
</style>
