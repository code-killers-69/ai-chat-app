<template>
  <div class="container">
    <div class="head-bar">
      <p>Chat Bot</p>
      <button class="login-btn" @click="showLoginModal = true" v-if="!isLogin">
        Login
      </button>
      <button class="logout-btn" @click="handleLogout" v-if="isLogin">
        Logout
      </button>
      <button @click="scrollToFloor" style="display: none">to floor</button>
      <div class="user-info" v-if="isLogin">
        <div class="user-name">username:{{ userInfoRef.username }}</div>
      </div>
    </div>
    <userLogin v-if="showLoginModal" class="userLogin" @on-login="onLogin" @exit="showLoginModal = false">
    </userLogin>
    <div class="scroll-area" ref="scrollArea">
      <div v-for="(message, index) in messages" style="display: flex; flex-direction: column" :class="{
        yourAlign: message.role === 'assistant',
        myAlign: message.role === 'user',
      }" key="message">
        <div class="message-bubble" :class="{
          yourStyle: message.role === 'assistant',
          myStyle: message.role === 'user',
        }">
          <div class="article-area">
            <Transition>
              <p id="streamer">{{ message.content }}</p>
            </Transition>
            <div v-show="index == messages.length - 1"></div>
          </div>
          <ImageContainer v-for="imageUrl in message.imageUrls" :image-url="imageUrl" :enable-loading-gif="false"
            :key="imageUrl" :size="200">
          </ImageContainer>
          <div class="time-tag">
            <p id="index">{{ message.time }}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="text-area">
      <ImageContainer v-for="imageUrl in imageUrls" :image-url="imageUrl" :enable-loading-gif="true">
      </ImageContainer>
      <input v-model="messageContent" type="text" class="message-input" placeholder="请输入文本" @keypress="sendMessageIn"
        @paste="handleImagePaste" />
      <input type="file" ref="fileInput" multiple accept="image/*" style="display: none" @change="handleFileChange" />
      <Transition>
        <button @click="fileInput.click()" class="add-btn">+</button>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue';
import ImageContainer from '@/componenets/imageContainer.vue';
import { getDate } from '@/utils/getCurrentTimestamp';
import userLogin from '@/componenets/userLogin.vue';
import { conversationIdRef, setToken, token, userInfoRef } from '@/states/user';
import { Message, messages } from '@/states/message';
import { handleFallBacks } from '@/utils/upLoadFallBacks';
import { useImageUpload } from '@/composables/useImageUpload';

const messageContent = ref('');
const scrollArea = ref(null);

const {
  isCompressing,
  imageUrls,
  imageMultipart,
  fallBackBlobs,
  generatePreviewAndUpload,
  clearImages,
} = useImageUpload();

const scrollToFloor = () => {
  scrollArea.value.scrollTo({
    top: scrollArea.value.scrollHeight,
    left: 0,
    behavior: 'instant',
  });
};

// 自动跳转最新消息
watch(messages, async () => {
  await nextTick();
  scrollToFloor();
});

const sendMessageIn = async (event) => {
  if (event.key !== 'Enter' || messageContent.value === '') return;
  if (isCompressing.value) {
    console.log('图片正在压缩中，请稍后发送...');
    return;
  }
  const currentTimestamp = getDate();
  messages.value.push(
    new Message(
      messageContent.value,
      currentTimestamp,
      'user',
      [...imageUrls.value], // Copy to avoid mutation issues
    ),
  );
  const newMessageContent = messageContent.value;
  messageContent.value = '';
  // Reset images in store

  //  处理上传包
  const formData = new FormData();
  formData.append('message', newMessageContent);
  formData.append('conversationId', conversationIdRef.value);
  for (const item of imageMultipart.value) {
    // 这里因为从worker拿到的是blob，为了能够正常上传，我们需要给它一个名字
    formData.append('images', item, 'image.webp');
  }

  clearImages();

  // 网络请求 流式传输
  const response = await fetch('http://scj.dolmo.top:3001/api/chat/stream', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const timeNow = getDate();
  messages.value.push(new Message('', timeNow, 'assistant'));

  const reader = response.body.getReader(); // 锁住可读数据流 给本次reader*实例
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read(); // 解析可读块
    if (done) break; //结束条件 流的最后一块触发done：true
    // 解码块数据
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type == 'conversation') {
            // 只拿首次会返回的有效的id，后续是undefined
            if (data.conversationId) {
              conversationIdRef.value = data.conversationId;
            }
          } else if (data.type == 'chunk') {
            messages.value[messages.value.length - 1].content += data.content;
            scrollToFloor();
          } else if (data.type == 'done') {
            //  处理兜底上传
            if (Array.isArray(data.imageIds) && data.imageIds.length > 0) {
              try {
                handleFallBacks(data.imageIds, fallBackBlobs.value);
              } catch (error) {
                Error(`兜底图上传错误：${error}`);
              }
            }
          } else {
            console.log('返回错误:', data.message);
          }
        } catch (error) {
          console.error('错误：', error);
        }
      }
    }
  }
};

//  文件选取
const handleFileChange = async (e) => {
  const files = e.target.files;
  if (files && files.length > 0) {
    generatePreviewAndUpload(files);
  }
};

//  输入框粘贴
const handleImagePaste = async (e) => {
  if (e.clipboardData && e.clipboardData.files.length) {
    const hasImage = Array.from(e.clipboardData.files).some((file) =>
      file.type.includes('image'),
    );
    if (hasImage) {
      e.preventDefault(); // 只在确认包含图片时阻止默认行为
      generatePreviewAndUpload(e.clipboardData.files);
    }
  }
};

//  初始化
const fileInput = ref(null);

const isLogin = ref(false);
const showLoginModal = ref(false);

const handleLogout = () => {
  localStorage.clear();
  isLogin.value = false;
  userInfoRef.value = {};
  setToken('');
};

const userInfoJSON = localStorage.getItem('userInfo');
const localToken = localStorage.getItem('token');
if (localToken && userInfoJSON) {
  userInfoRef.value = JSON.parse(userInfoJSON);
  setToken(localToken);
  isLogin.value = true;
}

const onLogin = () => {
  showLoginModal.value = false;
  isLogin.value = true;
};
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
</style>
