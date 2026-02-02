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
          <ImageContainer v-for="(imageUrl, index) in message.imageUrls" :image-url="imageUrl"
            :enable-loading-gif="false" ref="observeTarget">
          </ImageContainer>
          <div class="timeTag">
            <p>{{ message.time }}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="questionBar">

      <ImageContainer v-for="imageUrl in imageUrls" :image-url="imageUrl" :enable-loading-gif="true">
      </ImageContainer>
      <input v-model="messageContent" type="text" class="sendMessage" placeholder="请输入文本" @keypress="sendInQuestion"
        @paste="pasteDetected">
      <input type="file" ref="fileInput" multiple accept="image/*" style="display: none;" @change="handleFileChange">
      <Transition>
        <button @click="fileInput.click()" class="addBtn">+</button>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, useTemplateRef, onMounted, watch } from 'vue';
import ImageContainer from './componenets/imageContainer.vue'
import { getDate } from './utils/getTimeNow';

const messageContent = ref('')
const scrollArea = ref(null);


const messages = ref(['初始化1', '这阳光又兼大风的沐浴耗尽我的元气。我身上只剩下一丁点儿轻轻振臂的力量、低低呻吟的命脉和心灵微弱的反叛。要不了多久，我将飞向四面八方，忘掉一切也被自己遗忘。我将与风一体，融入这大风、这圆柱、这拱门、这灼热的石板以及这荒城四围苍凉的山峦。我还从未如此深切地感受到：既超脱了自我，又生存在这尘世中间。  ', '初始化3'].map((value) => {
  const timeNow = getDate()
  return { content: value, time: timeNow, role: 'you' }
}))


const sendInQuestion = (param1) => {
  if (param1.key !== 'Enter' || messageContent.value === '') return;
  const timeNow = getDate()
  messages.value.push({ content: messageContent.value, time: timeNow, role: 'me', imageUrls: imageUrls.value })
  messageContent.value = ''
  imageUrls.value = []
  messages.value.push({ content: `answer ${messages.value.length}`, time: timeNow, role: 'you' })
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

const pasteDetected = (e) => {

  e.preventDefault();
  console.log();
  for (const file of e.clipboardData.files) {
    if (e.clipboardData.files.length && file.type.includes('image')) {
      imageUrls.value.push(URL.createObjectURL(file))
    }
  }
}

const imageTarget = useTemplateRef('observeTarget')

const option = {
  root: scrollArea.value,
  threshold: 0.25,
}

const callBack = (entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.revealSelf()
      observer.unobserve(entry.target)
    }
  });
}

let observer = new IntersectionObserver(callBack, option);

watch(() => messages.value, async (newValue) => {

  await nextTick()
  if (!imageTarget.value) return
  imageTarget.value.forEach(instance => {
    const target = instance.$el;      //真正的实例管理的 DOM节点！操作dom节点来操作其组件
    if (target && !target.isObserved) {
      target.revealSelf = () => {
        instance.nowSeeMe()
      }
      observer.observe(target)
      target.isObserved = 'true'
    }
  });

}
  , { deep: true, immediate: true })



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
</style>
