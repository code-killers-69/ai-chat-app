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
          <div v-for="imageUrl in message.imageUrls">
            <img :src="imageUrl" style="max-width: 200px;margin: 5px 0;" />
          </div>
          <div class="timeTag">
            <p>{{ message.time }}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="questionBar">
      <input v-model="messageContent" type="text" class="sendMessage" placeholder="请输入文本" @keypress="sendInQuestion"
        @paste="handlePaste">
      <input type="file" ref="fileInput" multiple accept="image/*" style="display: none;" @change="handleFileChange">
      <Transition>
        <button @click="fileInput.click()" v-if="imageShow" class="addBtn">+</button>
      </Transition>
      <div style="display: flex;max-width: 200px;overflow: scroll;scrollbar-width: none;flex-shrink: 0;">
        <TransitionGroup>
          <img v-for="(imageUrl, index) in imageUrls" :key="index" :src="imageUrl"
            style="min-width:100px;margin: 0 2px;" ref="imageItem" />
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, useTemplateRef } from 'vue';

const getNow = () => {
  const date = new Date(Date.now())
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return { hours, minutes }
}

const imageShow = ref(true)
const messageContent = ref('')
const messages = ref(['初始化1', '初始化2', '初始化3'].map((value) => {
  const now = getNow();
  return { content: value, time: `${now.hours}:${now.minutes} pm`, role: 'you' }
}))

const scrollArea = ref(null);
const sendInQuestion = (param1) => {
  if (param1.key !== 'Enter' || (messageContent.value === '' && imageUrls.value.length === 0)) return;
  const now = getNow();
  messages.value.push({ content: messageContent.value, time: `${now.hours}:${now.minutes} pm`, role: 'me', imageUrls: imageUrls.value })
  if (imageUrls.value.length != 0) (
    imageShow.value = !imageShow.value
  )
  messageContent.value = ''
  imageUrls.value = []
  messages.value.push({ content: `answer ${messages.value.length}`, time: `${now.hours}:${now.minutes} pm`, role: 'you' })
  nextTick(() => {
    scrollArea.value.scrollTo({
      top: scrollArea.value.scrollHeight,
      left: 0,
      behavior: "smooth",
    })
  })
}

const imageRefs = useTemplateRef("imageItem")
const fileInput = ref(null);
const imageUrls = ref([]);

const handleFileChange = (e) => {
  const files = e.target.files;
  if (files.length === 0) return;
  for (const file of files) {
    imageUrls.value.push(URL.createObjectURL(file))
  }
  handleWaitImagesLoad()
};

const handleWaitImagesLoad = () => {
  nextTick(() => {
    let count = 0;
    for (const imageRef of imageRefs.value) {
      imageRef.onload = () => {
        if (++count === imageRefs.value.length) {
          imageShow.value = !imageShow.value
        }
      }
    }
  })
}

const handlePaste = (e) => {
  const files = e.clipboardData.files;
  if (files.length === 0) return;
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      imageUrls.value.push(URL.createObjectURL(file))
      e.preventDefault();
    }
  }
  handleWaitImagesLoad()
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

.sendMessage {
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
  transition: all 1s ease;
}

.v-leave-active {
  transition: all 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

.addBtn {
  height: 100px;
  width: 100px;
  flex-shrink: 0;
  background-color: rgb(223, 223, 223);
  border: none;
  border-radius: 5px;
  font-weight: 700;
}

.addBtn:hover {
  background-color: rgb(192, 192, 192);
}
</style>
