<template>
    <div class="container">
        <button class="createNewConvo" @click="createNewConvo">New Convo</button>
        <div class="conversation" v-for="conversation in conversations" @click="choseConvo(conversation)">{{
            conversation.title }}
        </div>
    </div>
</template>

<script setup>
import { conversations, Conversation } from '@/states/conversation';
import { Message, messages } from '@/states/message';
import { conversationIdRef } from '@/states/user';

const choseConvo = async (conversation) => {

    messages.value = conversation.messages
    if (conversation.messages.length === 0&&conversation.id) {   
        const conversationId = conversation.id;
        conversationIdRef.value = conversation.id;
        const token = localStorage.getItem('token');
        const response = await fetch(`http://www.dolmo.top:3001/api/conversations/${conversationId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        messages.value = data.data.messages.map((message) => new Message(message['content'], message['created_at'], message['role'], message['images']))
        conversation.messages = messages.value
    }
}



const createNewConvo = () => {
    conversations.value.push(new Conversation(null, `newConvo${conversations.value.length+1}`))
}

defineExpose({ choseConvo })
</script>

<style scoped>
.container {
    display: flex;
    flex-direction: column;
}
</style>