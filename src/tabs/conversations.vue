<template>
  <div class="container">
    <button class="createNewConvo" @click="createNewConvo">New Convo</button>
    <div class="conversation" v-for="(conversation, index) in conversations" @click="choseConvo(conversation, index)"
      ref="convoList" style="display: flex">
      <div class="title">
        {{ conversation.title }}
      </div>
      <button class="title-change-btn" @click="shareIndex(index)">
        change
      </button>
      <button class="delete-btn" @click="handleConvoDelete(conversation, index)">
        Delete
      </button>
    </div>
    <input type="text" v-model="newTitle" v-show="showTitle" @keypress="handleTitleChange" />
  </div>
</template>

<script setup>
import { conversations, Conversation } from "@/states/conversation";
import { Message, messages } from "@/states/message";
import { conversationIdRef } from "@/states/user";
import { nextTick, ref, useTemplateRef } from "vue";

const convoListRef = useTemplateRef("convoList");

const choseConvo = async (conversation, index) => {
  //  message常规请求：

  // 当前convo高亮
  await nextTick();
  convoListRef.value.forEach((convo) => {
    convo.classList.remove("selected");
  });
  convoListRef.value[index ? index : 0].classList.add("selected");

  // 首次请求
  if (conversation.messages.length === 0 && conversation.id) {
    let conversationId = conversation.id;
    const token = localStorage.getItem("token");
    const response = await fetch(
      `http://scj.dolmo.top:3001/api/conversations/${conversationId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await response.json();
    conversation.messages = data.data.messages.map(
      (message) =>
        new Message(
          message["content"],
          message["created_at"],
          message["role"],
          message["images"].map((image) => ({ webpUrl: image.url, fallBacks: image.fallbackUrl })),
        ),
    );
  }
  messages.value = conversation.messages;
  conversationIdRef.value = conversation.id;
};

//  新建convo:

const createNewConvo = async () => {
  conversations.value.push(
    new Conversation(null, `newConvo${conversations.value.length + 1}`),
  );
  await nextTick();
  convoListRef.value[convoListRef.value.length - 1].click(); //自动跳转到新convo
};

//  删除convo：
const handleConvoDelete = async (conversation, index) => {
  const conversationId = conversation.id;
  conversations.value.splice(index, 1);
  const token = localStorage.getItem("token");
  const response = await fetch(
    `http://scj.dolmo.top:3001/api/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
};

//  修改title：
const showTitle = ref(false);
let titleIndex;
const newTitle = ref("");
const shareIndex = (index) => {
  showTitle.value = true;
  newTitle.value = conversations.value[index].title;
  titleIndex = index;
};

const handleTitleChange = async (e) => {
  if (e.key !== "Enter" || newTitle.value === "") return;
  console.log();
  conversations.value[titleIndex].title = newTitle.value;
  const token = localStorage.getItem("token");
  const response = await fetch(
    `http://scj.dolmo.top:3001/api/conversations/${conversationIdRef.value}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: `${newTitle.value}` }),
    },
  );
  const data = await response.json();
  if (data.success) {
    newTitle.value = "";
    showTitle.value = false;
  }
};

defineExpose({ choseConvo });
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
}

.selected {
  color: rgb(6, 49, 135);
  font-weight: bolder;
}
</style>
