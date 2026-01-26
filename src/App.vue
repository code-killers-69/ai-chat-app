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
      <input v-model="messageContent" type="text" class="sendMessage" placeholder="请输入文本" @keypress="sendInQuestion">
      <input type="file" ref="fileInput" multiple accept="image/*" style="display: none;" @change="handleFileChange">
      <button @click="fileInput.click()">+</button>
      <img v-for="imageUrl in imageUrls" :src="imageUrl" style="max-width: 200px;margin: 0 5px;" />
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';

const messageContent = ref('')
const messages = ref(['初始化1', '初始化2', '初始化3'].map((value) => {
  const date = new Date(Date.now())
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return { content: value, time: `${hours}:${minutes} pm`, role: 'you' }
}))

const scrollArea = ref(null);

const sendInQuestion = (param1) => {
  if (param1.key !== 'Enter' || messageContent.value === '') return;
  const date = new Date(Date.now())
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  messages.value.push({ content: messageContent.value, time: `${hours}:${minutes} pm`, role: 'me', imageUrls: imageUrls.value })
  messageContent.value = ''
  imageUrls.value = []
  messages.value.push({ content: `answer ${messages.value.length}`, time: `${hours}:${minutes} pm`, role: 'you' })
  nextTick(() => {
    scrollArea.value.scrollTo({
      top: scrollArea.value.scrollHeight,
      left: 0,
      behavior: "smooth",
    })
  })
}

const fileInput = ref(null);
const imageUrls = ref([]);

const handleFileChange = (e) => {
  const files = e.target.files;
  if (files.length > 0) {
    for (const file of files) {
      imageUrls.value.push(URL.createObjectURL(file))
    }
  }
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
</style>
