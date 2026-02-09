<template>
    <div class="container">
        <div class="head-bar">
            <p>Chat Bot</p>
            <button class="login-btn" @click="showLoginModal = true;" v-if="!isLogin">Login</button>
            <button class="logout-btn" @click="handleLogout" v-if="isLogin">Logout</button>
            <div class="user-info" v-if="isLogin">
                <div class="user-name">username:{{ userInfoRef.username }}</div>
            </div>
        </div>
        <userLogin v-if="showLoginModal" class="userLogin" @on-login="onLogin" @exit="showLoginModal = false">
        </userLogin>
        <div class="scroll-area" ref="scrollArea">
            <div v-for="message in messages" style="display: flex; flex-direction: column" :class="{
                yourAlign: message.role === 'assistant',
                myAlign: message.role === 'user',
            }">
                <div class="message-bubble" :class="{
                    yourStyle: message.role === 'assistant',
                    myStyle: message.role === 'user',
                }">
                    <div class="article-area">
                        <p>{{ message.content }}</p>
                    </div>
                    <ImageContainer v-for="imageUrl in message.imageUrls" :image-url="imageUrl"
                        :enable-loading-gif="false" v-observe :key="imageUrl" :size="200">
                    </ImageContainer>
                    <div class="time-tag">
                        <p>{{ message.time }}</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="text-area">
            <ImageContainer v-for="imageUrl in imageUrls" :image-url="imageUrl" :enable-loading-gif="true">
            </ImageContainer>
            <input v-model="messageContent" type="text" class="message-input" placeholder="请输入文本"
                @keypress="sendMessageIn" @paste="handlePaste" />
            <input type="file" ref="fileInput" multiple accept="image/*" style="display: none"
                @change="handleFileChange" />
            <Transition>
                <button @click="fileInput.click()" class="add-btn">+</button>
            </Transition>
        </div>
    </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue';
import ImageContainer from '@/componenets/imageContainer.vue';
import { getDate } from '@/utils/getCurrentTimestamp';
import userLogin from '@/componenets/userLogin.vue';
import { conversationIdRef, newConvoId, setToken, token, userInfoRef } from '@/states/user';
import { Message, messages } from '@/states/message';
const messageContent = ref('')
const scrollArea = ref(null);

const sendMessageIn = async (event) => {
    if (event.key !== 'Enter' || messageContent.value === '') return;
    const currentTimestamp = getDate()
    messages.value.push(new Message(messageContent.value, currentTimestamp, 'user', imageUrls.value))
    const newMessageContent = messageContent.value;
    messageContent.value = ''
    imageUrls.value = [];


    const respose = await fetch('http://scj.dolmo.top:3001/api/chat/message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },

        body: JSON.stringify({ message: newMessageContent, conversationId: conversationIdRef.value, images: imageBase64s })
    })

    const test = await respose.json()
    conversationIdRef.value = test.data.conversationId //新对话id首次获取
    messages.value.push(new Message(test.data.content, currentTimestamp, 'assistant'))

    imageBase64s.length = 0
    nextTick(() => {
        scrollArea.value.scrollTo({
            top: scrollArea.value.scrollHeight,
            left: 0,
            behavior: 'smooth',
        })
    })
}

const fileInput = ref(null);
const imageUrls = ref([]);
const imageBase64s = [];

const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
        for (const file of files) {
            const reader = new FileReader();
            imageUrls.value.push(URL.createObjectURL(file))
            reader.readAsDataURL(file)
            reader.onloadend = () => {
                imageBase64s.push(reader.result)
            }
        }

    }
};

const handlePaste = (e) => {
    e.preventDefault();
    for (const file of e.clipboardData.files) {
        if (e.clipboardData.files.length && file.type.includes('image')) {
            imageUrls.value.push(URL.createObjectURL(file));
        }
    }
}

let observer;

observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target.querySelector(".imageBlock")
            img.src = img.dataset.url
            observer.unobserve(entry.target)
        }
    });
}, {
    root: null,
    threshold: 0.25,
});

const vObserve = {
    mounted: (el) => {
        if (observer) {
            observer.observe(el)
        }
    },
    beforeMount(el) {
        const img = el.querySelector(".imageBlock")
        img.dataset.url = img.src
        img.src = ''
    },
    unmounted: (el) => {
        observer.unobserve(el)
    },
}

const isLogin = ref(false);
const showLoginModal = ref(false)

const handleLogout = () => {
    localStorage.clear()
    isLogin.value = false;
    userInfoRef.value = {}
    setToken('')
}

const userInfoJSON = localStorage.getItem('userInfo')
const localToken = localStorage.getItem('token')
if (localToken && userInfoJSON) {
    userInfoRef.value = JSON.parse(userInfoJSON)
    setToken(localToken)
    isLogin.value = true
}

const onLogin = () => {
    showLoginModal.value = false;
    isLogin.value = true;
}
</script>

<style scoped>
* {
    padding: 0;
    margin: 0;
    box-sizing: border-box;
}

.container {
    position: relative;
    height: 100vh;
    width: 800px;
    margin: 0 auto;
    padding: 0 0 40px 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: hidden;
}

.head-bar {
    width: 100%;
    height: 60px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
}

.message-bubble {
    padding: 10px;
    margin-bottom: 20px;
    background-color: white;
    border-radius: 10px;
    width: fit-content;
    max-width: 600px;
    display: flex;
    flex-direction: column;
}

.text-area {
    display: flex;
    /* flex-direction: column; */
    margin: 0 auto;
    width: 80%;
    background-color: whitesmoke;
    padding: 20px;
    border-radius: 15px;
    flex-shrink: 0;
}

.scroll-area {
    flex: 1;
    overflow-y: auto;
}

.article-area {
    margin-bottom: 5px;
}

.time-tag {
    font-size: 0.6rem;
    font-weight: 700;
    opacity: 0.5;
}

.message-input {
    width: 100%;
    outline: none;
    border: none;
    border-radius: 10px;
    background-color: whitesmoke;
}

.yourStyle {
    background-color: #e9eef6;
    margin-left: 40px;
}

.yourStyle .time-tag {
    margin-left: auto;
}

.myStyle {
    background-color: greenyellow;
    margin-right: 40px;
}

.yourAlign {
    align-items: flex-start;
}

.myAlign {
    align-items: flex-end;
}

.v-enter-active,
.v-leave-active {
    transition: opacity 1s ease;
}

.v-enter-from,
.v-leave-to {
    opacity: 0;
}

.add-btn {
    height: 20px;
    width: 20px;
    background-color: rgb(223, 223, 223);
    border: none;
    border-radius: 5px;
    transition: all 0.5s ease;
    font-weight: 700;
}

.add-btn:hover {
    background-color: rgb(192, 192, 192);
}

.login-btn {
    align-items: flex-end;
}

.userLogin {
    position: absolute;
    top: 200px;
    left: 50%;
    transform: translateX(-50%);
}
</style>
