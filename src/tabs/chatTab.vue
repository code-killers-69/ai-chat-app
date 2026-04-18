<template>
    <div class="container">
        <!-- 顶部工具栏 -->
        <div class="head-bar">
            <!-- 切换模型 -->
            <ModelSwitch class="model-switch"></ModelSwitch>
            <p>Chat Bot</p>
            <!-- 登录和状态显示 -->
            <userLogin style="margin-bottom: 20px;"></userLogin>
        </div>
        <!-- 滚动区域 -->
        <div class="scroll-area" ref="scrollAreaRef">
            <!-- 哨兵 -->
            <div ref="sentinelRef" style="height: 0 ;width: 0;" :class="{ 'in-active': !isShowSentinel }">
            </div>
            <!-- 消息框 -->
            <MessageContainer v-for="message in messages" :message="message"></MessageContainer>
        </div>
        <!-- 输入区域 -->
        <div class="text-area">
            <ImageContainer v-for="imageUrl in imageUrls" :image-url="imageUrl" :enable-loading-gif="true">
            </ImageContainer>
            <input v-model="messageEntered" type="text" class="message-input" placeholder="请输入文本"
                @keypress="handleMsgEnter" @paste="handlePasteImage" />
            <input type="file" ref="fileInput" multiple accept="image/*" style="display: none"
                @change="handleFileChange" />
            <Transition>
                <button @click="fileInput.click()" class="add-btn">+</button>
            </Transition>
        </div>
    </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted } from 'vue';
import ImageContainer from '@/componenets/imageContainer.vue';
import userLogin from '@/componenets/userLogin.vue';
import ModelSwitch from '@/componenets/modelSwitch.vue';
import MessageContainer from '@/componenets/messageContainer.vue';

import getFetch from '@/utils/getFetch';
import getDate from '@/utils/getCurrentTimestamp';
import getChunkComplete from '@/utils/getChunkComplete';

import { storeToRefs } from 'pinia';
import { useUserStore } from '@/states/user';
import { useModelStore } from '@/states/useModelStore';
import { useConvoStore } from '@/states/conversation';
import { useMessageStore, Message } from '@/states/message';

import { imageHandler } from '@/composable/imageHandler';
import { handleFallBacks } from '@/utils/upLoadFallBacks';

const {
    isCompressing,
    imageUrls,
    imageMultipart,
    fallBackBlobs,
    generatePreviewAndUpload,
    clearImages
} = imageHandler()

const userStore = useUserStore()
const messageStore = useMessageStore()
const modelStore = useModelStore()
const convoStore = useConvoStore()

const { token } = storeToRefs(userStore)
const { haveNewMessage, messages, fetchCount, allowWatch } = storeToRefs(messageStore)
const { modelIdChosen } = storeToRefs(modelStore)
const { conversationIdRef, conversations } = storeToRefs(convoStore)
const scrollAreaRef = ref(null);
const sentinelRef = ref(null)
const oldScrollHeight = ref(0)
const isShowSentinel = ref(false);
let observerSentinel

onMounted(() => {
    // 初始化监视器
    observerSentinel = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && haveNewMessage.value && conversationIdRef.value) {
            oldScrollHeight.value = scrollAreaRef.value.scrollHeight;
            allowWatch.value = true;
            fetchCount.value++;
        }
    },
        {
            root: scrollAreaRef.value,
            threshold: 0,
            rootMargin: "100px 0px 0px 0px"
        })

    observerSentinel.observe(sentinelRef.value)
})

//  触底工具函数
const scrollToFloor = async () => {
    await nextTick()
    scrollAreaRef.value.scrollTo({
        top: scrollAreaRef.value.scrollHeight + 1000,
        left: 0,
        behavior: 'instant',
    })
}

// 滚动锚定
watch(messages, async () => {
    if (!allowWatch.value || token.value === '') {
        if (messages.value.length == 0) isShowSentinel.value = false //  退出登录/添加会话时关闭哨兵
        return
    }
    //  阅后即焚，焚后即悦
    allowWatch.value = false
    isShowSentinel.value = false
    await nextTick();

    //  锚定
    if (scrollAreaRef.value.scrollHeight > oldScrollHeight.value) {
        requestAnimationFrame(() => {
            const newSrollHeight = scrollAreaRef.value.scrollHeight
            const scrollTop = scrollAreaRef.value.scrollTop
            scrollAreaRef.value.scrollTop = newSrollHeight - oldScrollHeight.value + scrollTop
        })
    };

    // 请求锁控制烧饼是否继续工作
    if (haveNewMessage.value) {
        isShowSentinel.value = true;
    } else {
        isShowSentinel.value = false;
    }
}, { deep: true })

// 切换会话状态重置
watch(conversationIdRef, async () => {
    haveNewMessage.value = true;
    await nextTick()
    scrollToFloor();
}, { deep: true })

//  键入事件
const messageEntered = ref('')
const handleMsgEnter = async (event) => {
    if (event.key !== 'Enter' || messageEntered.value === '') return;
    //  最好做一个UI同步状态
    if (isCompressing.value) {
        console.log('图片正在压缩...');
        return
    }
    //  获取逻辑变量
    const newMessageEntered = messageEntered.value;
    const assistantMsg = new Message('', getDate(), 'assistant')

    //  重置状态 处理UI变化
    messages.value.push(new Message(messageEntered.value, getDate(), 'user', [...imageUrls.value]))
    messageEntered.value = ''
    scrollToFloor();

    //  UI占位 通过对象引用
    messages.value.push(assistantMsg)

    //  处理单次信息
    const formData = new FormData()
    formData.append('message', newMessageEntered)
    formData.append('conversationId', conversationIdRef.value ? conversationIdRef.value : '')
    formData.append('model', modelIdChosen.value)
    for (const image of imageMultipart.value) {
        formData.append('images', image)
    }

    clearImages()

    //  流式传输
    try {
        // 发起请求
        const response = await getFetch(
            '/api/chat/stream',
            false,
            {
                method: 'POST',
                headers: {
                    ...(token.value ? { 'Authorization': `Bearer ${token.value}` } : {})
                },
                body: formData

            })

        //  处理返回的字段，异步生成器保证字段以标准格式返回，由异步迭代器接受拼接
        for await (const data of getChunkComplete(response)) {

            switch (data.type) {
                case "conversation":
                    if (data.conversationId) {
                        conversationIdRef.value = data.conversationId;
                        const index = conversations.value.length - 1
                        if (conversations.value[index]) {
                            //  同步到本地数组
                            conversations.value[index].id = conversationIdRef.value
                        }
                    };
                    break;
                case "chunk":
                    assistantMsg.content.value += data.content
                    scrollToFloor()
                    break;
                case "done":
                    if (Array.isArray(data.imageIds) && data.imageIds.length) {
                        try {
                            handleFallBacks(data.imageIds, fallBackBlobs.value)
                        } catch (error) {
                            Error('兜底图上传错误')
                        }
                    }
                    console.log('回复完成')
                    break;
                case "error":
                    console.log('返回错误:', data.message)
                    break;
            }
        }
    } catch (error) {
        console.error('字段拼接异常：', error);
        assistantMsg.content.value = "消息生成异常"
    }

}

//  处理图片上传逻辑
const fileInput = ref(null);

//  图片上传
const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        generatePreviewAndUpload(files)
    }
};

//  图片粘贴
const handlePasteImage = (e) => {
    if (e.clipboardData && e.clipboardData.files.length) {
        const hasImage = Array.from(e.clipboardData.files).some((file) =>
            file.type.includes('image'),
        );
        if (hasImage) {
            e.preventDefault(); // 只在确认包含图片时阻止默认行为
            generatePreviewAndUpload(e.clipboardData.files);
        }
    }
}

</script>

<style scoped>
* {
    padding: 0;
    margin: 0;
    box-sizing: border-box;
}

body {
    overflow-anchor: none;
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
    position: relative;
    width: 100%;
    height: 60px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
}

.text-area {
    display: flex;
    margin: 0 auto;
    width: 80%;
    background-color: whitesmoke;
    padding: 20px;
    border-radius: 15px;
    flex-shrink: 0;
}

.scroll-area {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
}

.scroll-area::-webkit-scrollbar {
    display: none;
}

.message-input {
    width: 100%;
    outline: none;
    border: none;
    border-radius: 10px;
    background-color: whitesmoke;
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

.v-enter-active,
.v-leave-active {
    transition: opacity 1s ease;
}

.v-enter-from,
.v-leave-to {
    opacity: 0;
}

.cursor {
    width: 2px;
    height: 15px;
    background-color: black;
    animation: blink 0.8s infinite;
}

@keyframes blink {
    0% {
        opacity: 1;
    }

    50% {
        opacity: 0;
    }

    100% {
        opacity: 1;
    }
}

.in-active {
    display: none;
}

.model-switch {
    position: absolute;
    left: 20px;
    top: 20px;
    height: 340px;
    width: 170px;
}
</style>
