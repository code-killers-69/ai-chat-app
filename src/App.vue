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
            <img :src="imageUrl" style="max-width: 200px;margin: 5px 0; border-radius: 10px;" />
          </div>
          <div class="timeTag">
            <p>{{ message.time }}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="questionBar">
      <div v-for="imageUrl in imageUrls"
        style="position: relative; display: flex;max-width: 200px;min-width: 120px;overflow: scroll;scrollbar-width: none;">
        <div class="placeHold"
          style="height: 100px; position: relative;width:100px;margin: 0 2px; border-radius: 5px; background-color: rgb(164,125,171);">
          <img src="/public/gif/loading.gif" alt="loading"
            style="height: 100px; ;min-width:100px;margin: 0 auto; border-radius: 5px">
        </div>
        <img :src="imageUrl"
          style=" position: absolute; top:0;left:0;  min-width:100px;height: 100px; margin: 0 2px; border-radius: 5px;transition: all 0.4s ease;"
          ref="imageItem" />
      </div><br>
      <input v-model="messageContent" type="text" class="sendMessage" placeholder="请输入文本" @keypress="sendInQuestion">
      <input type="file" ref="fileInput" multiple accept="image/*" style="display: none;" @change="handleFileChange">
      <Transition>
        <div class="testDiv" v-if="imageShow">
          <button @click="fileInput.click()" class="addBtn">+</button>
        </div>
      </Transition>

    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, useTemplateRef } from 'vue';

const imageShow = ref(true)
const messageContent = ref('')
const messages = ref(['初始化1', '这阳光又兼大风的沐浴耗尽我的元气。我身上只剩下一丁点儿轻轻振臂的力量、低低呻吟的命脉和心灵微弱的反叛。要不了多久，我将飞向四面八方，忘掉一切也被自己遗忘。我将与风一体，融入这大风、这圆柱、这拱门、这灼热的石板以及这荒城四围苍凉的山峦。我还从未如此深切地感受到：既超脱了自我，又生存在这尘世中间。  ', '初始化3'].map((value) => {
  const date = new Date(Date.now())
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return { content: value, time: `${hours}:${minutes} ${hours < 12 ? "AM" : "PM"}`, role: 'you' }
}))

const scrollArea = ref(null);

const sendInQuestion = (param1) => {
  if (param1.key !== 'Enter' || messageContent.value === '') return;
  const date = new Date(Date.now())
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  messages.value.push({ content: messageContent.value, time: `${hours}:${minutes} ${hours < 12 ? "AM" : "PM"}`, role: 'me', imageUrls: imageUrls.value })
  if (imageUrls.value.length != 0) (
    imageShow.value = !imageShow.value
  )
  messageContent.value = ''
  imageUrls.value = []
  messages.value.push({ content: `answer ${messages.value.length}`, time: `${hours}:${minutes} ${hours < 12 ? "AM" : "PM"}`, role: 'you' })
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
  if (files.length > 0) {
    for (const file of files) {
      imageUrls.value.push(URL.createObjectURL(file))
    }
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
  max-width: 600px;
  display: flex;
  flex-direction: column;
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
  font-size: 0.6rem;
  font-weight: 700;
  opacity: 0.5;
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

.yourStyle .timeTag {
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

.addBtn {
  height: 20px;
  width: 20px;
  background-color: rgb(223, 223, 223);
  border: none;
  border-radius: 5px;
  transition: all 0.5s ease;
  font-weight: 700;
}

.addBtn:hover {
  background-color: rgb(192, 192, 192);
}

/* .placeHolderShow{
  displ
} */
</style>
