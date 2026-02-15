<template>
  <div class="container">
    <Conversations ref="conversationsRef"></Conversations>
    <MainTab class=" main-tab">
    </MainTab>
  </div>
</template>

<script setup>
import MainTab from './tabs/mainTab.vue';
import Conversations from './tabs/conversations.vue';
import { onMounted, ref } from 'vue';
import { Conversation, conversations } from './states/conversation';

const conversationsRef = ref(null);

onMounted(async () => {
  const token = localStorage.getItem('token')
  if (token) {
    const response = await fetch('http://scj.dolmo.top:3001/api/conversations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    conversations.value = data.data.map((conversion) => new Conversation(conversion['id'], conversion['title'], conversion['created_at'], conversion['updated_at']));
    conversationsRef.value.choseConvo(conversations.value[0])
  }
})

</script>

<style scoped>
.container {
  display: flex;
}
</style>
