<template>
  <div class="container">
    <div class="headBar">
      <p>shall we talk</p>
      <button class="clearBtn" @click="clearMessage">CLEAR</button>
    </div>
    <div class="scrollArea">
      <!-- 模版组件，根据role成员属性区分样式 -->
      <div class="messageBox" v-for="message in messages"
      :class="{yourStyle:message.role==='you',myStyle:message.role==='me'}">
        <div class="articleArea">
          {{ message.content }}
        </div>
        <div class="timeTag">
          {{ message.time }}
        </div>
      </div>
    </div>
    <div class="textArea">
      <input v-model="messageContent" class="sendMessage" type="text"  placeholder="请输入文本" @keypress="sendMessageTo">
      <!--
        上传图片 使用file表单 拿到file生成本地url push到message.   事件实例.target.files=>
        预览图片 img标签便利渲染 message的url
        发送图片 消息盒子img标签便利渲染 url
      -->
      <input type="file" multiple ref="imageInput" class="getImageBtn" style="display: none;" @change="getImageUrl">
      <button @click="imageInput.click()">+</button>
      
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const messageContent=ref('')
const exampleArr = ['texas blue', 'GONE GONE/ THANK YOU', 'Liz']
// 创建响应式message数组
const messages = ref(exampleArr.map((value) => {
  const hours = new Date().getHours().toString().padStart(2, '0');
  const minutes = new Date().getMinutes().toString().padStart(2, '0')
  return { content: value, time: `${hours}:${minutes} ${hours < 12 ? 'am' : 'pm'}`, role: "you" }
}))

const clearMessage=()=>{
  messages.value=[];
  console.log(messages);
}
  //发送输入框内容时将本次输入信息添加到message数组中去渲染,清空输入框
const sendMessageTo=(sendKey)=>{
  // console.log(sendKey.key);
  if(sendKey.key!=='Enter'||messageContent.value==='') return
  const hours = new Date().getHours().toString().padStart(2, '0');
  const minutes = new Date().getMinutes().toString().padStart(2, '0');
  messages.value.push({content:messageContent.value,time: `${hours}:${minutes} ${hours < 12 ? 'am' : 'pm'}`,role:'me'})
  messageContent.value=''
  messages.value.push({content:`response${messages.value.length}`,time: `${hours}:${minutes} ${hours < 12 ? 'am' : 'pm'}`,role:'you'})
  console.log(messages);
}
console.log(messages);

const imageInput=ref(null) //vue方法获取组件
const imageUrls=e=ref([])

const getImageUrl=(e)=>{
  console.log(e);
  const files=e.target.files
  if(files.length>0){
    for(let i=0;i<files.length-1;i++)
    imageUrls.value.push(files[i])
  }
  const url=URL.createObjectURL(files)

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

  
.scrollArea {
  flex: 1;
  overflow-y: auto;
}

.textArea {
  display: flex;
  /* flex-direction: column; */
  margin: 0 auto;
  width: 80%;
  background-color: whitesmoke;
  padding: 20px;
  border-radius: 15px;
  flex-shrink: 0;
}

.messageBox {
  padding: 10px;
  margin-bottom: 20px;
  background-color: white;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  width: fit-content;
  max-width: 250px;
  word-break: break-all;
  word-wrap: break-word;
}

.yourStyle {
  background-color: #e9eef6;
  margin-right: auto;
  margin-left: 40px;
}

.myStyle {
  background-color: greenyellow;
  margin-left: auto;
  margin-right: 40px;
}

.sendMessage {
  width: 100%;
  outline: none;
  border: none;
  border-radius: 10px;
  background-color: whitesmoke;
}
</style>
