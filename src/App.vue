<template>
  <div class="container">
    <div class="headBar">
      <p>Chat Bot</p>
    </div>
    <div class="scrollArea" ref="scrollArea">
      <div v-for="message in messages" style="display: flex;flex-direction: column;"
        :class="{ yourAlign: message.role === 'you', myAlign: message.role === 'me' }">
        <div class="questionTank" :class="{ yourStyle: message.role === 'you', myStyle: message.role === 'me' }">
          <div class="articleArea">
            <p>{{ message.content }}</p>
          </div>
          <!-- 这里发送的内容有图片的情况下，原本的滚动到底部逻辑此时不会真正滚动到底部，原因是滚动逻辑开始时是所有dom挂载后，虽然此时img已经挂载了，但是还没有加载出图片内容，所以没有高度，所以图片的高度没有计算到滚动长度中，于是不能真正滚动到底部。解决的办法也很简单，同样等所有图片loaded之后再滚动即可 -->
          <div v-for="image in message.images">
            <img :src="image.imageUrl" style="max-width: 200px;margin: 5px 0;" />
          </div>
          <div class="timeTag">
            <p>{{ message.time }}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="questionBar">
      <div class="imageContainers">
        <ImageContainer v-for="(image, index) in images" :key="index" :image-url="image.imageUrl"
          @onImageLoaded="onImageLoaded" :enable-loading-animation="true">
        </ImageContainer>
      </div>
      <div class="inputArea">
        <input v-model="messageContent" type="text" class="inputMessage" placeholder="请输入文本" @keypress="sendInQuestion"
          @paste="handlePaste">
        <input type="file" ref="fileInput" multiple accept="image/*" style="display: none;" @change="handleFileChange">
        <Transition>
          <button @click="fileInput.click()" class="addBtn">+</button>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import ImageContainer from './componenets/imageContainer.vue';

const getNow = () => {
  const date = new Date(Date.now())
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return { hours, minutes }
}

const messageContent = ref('')
const messages = ref(['初始化1', '初始化2', '初始化3'].map((value) => {
  const now = getNow();
  return { content: value, time: `${now.hours}:${now.minutes} pm`, role: 'you' }
}))

const scrollArea = ref(null);
const sendInQuestion = (param1) => {
  if (param1.key !== 'Enter' || (messageContent.value === '' && images.value.length === 0)) return;

  const now = getNow();
  messages.value.push({ content: messageContent.value, time: `${now.hours}:${now.minutes} pm`, role: 'me', images: images.value })
  messages.value.push({ content: `answer ${messages.value.length}`, time: `${now.hours}:${now.minutes} pm`, role: 'you' })

  messageContent.value = ''
  images.value = []

  nextTick(() => {
    scrollArea.value.scrollTo({
      top: scrollArea.value.scrollHeight,
      left: 0,
      behavior: "smooth",
    })
  })
}

const fileInput = ref(null);
const images = ref([]);
let count = 0;

const onImageLoaded = () => {
  if (++count === images.value.length) {
    count = 0
    console.error('all image loaded');
  }
}

const handleFileChange = (e) => {
  const files = e.target.files;
  if (files.length === 0) return;
  for (const file of files) {
    images.value.push({ imageUrl: URL.createObjectURL(file), isLoaded: false })
  }
  onImageLoaded()
};

const handlePaste = (e) => {
  const files = e.clipboardData.files;
  if (files.length === 0) return;
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      images.value.push({ imageUrl: URL.createObjectURL(file), isLoaded: false })
      e.preventDefault();
    }
  }
  onImageLoaded()
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

.headBar {
  width: 100%;
  height: 60px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
}

.questionTank {
  padding: 10px;
  margin-bottom: 20px;
  background-color: white;
  border-radius: 10px;
  width: fit-content;
}

.questionBar {
  display: flex;
  flex-direction: column;
  /* flex-direction: column; */
  margin: 0 auto;
  width: 80%;
  background-color: whitesmoke;
  padding: 20px;
  border-radius: 15px;
  flex-shrink: 0;
}

.scrollArea {
  flex: 1;
  overflow-y: auto;
}

.articleArea {
  margin-bottom: 5px;
}

.timeTag {
  font-size: 0.1em;
}

.inputMessage {
  width: 100%;
  outline: none;
  border: none;
  background-color: whitesmoke;
}

.yourStyle {
  background-color: #e9eef6;
  margin-left: 40px;
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

.v-enter-active {
  transition: opacity 1s ease;
}

.v-leave-active {
  transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

.addBtn {
  height: 20px;
  width: 20px;
  flex-shrink: 0;
  background-color: rgb(223, 223, 223);
  border: none;
  border-radius: 5px;
  font-weight: 700;
}

.addBtn:hover {
  background-color: rgb(192, 192, 192);
}

.imageContainers {
  display: flex;
  width: 100%;
  overflow: scroll;
  scrollbar-width: none;
}

.inputArea {
  display: flex;
  flex-direction: row;
  margin: 20px 0;
  justify-content: space-between;
}
</style>
