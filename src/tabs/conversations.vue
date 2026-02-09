<template>
    <div class="container">
        <button class="createNewConvo" @click="createNewConvo">New Convo</button>
        <div class="conversation" v-for="(conversation, index)  in conversations" @click="choseConvo(conversation)"
            ref="convoList" style="display: flex;">
            <div class="title">
                {{ conversation.title }}
            </div>
            <button class="delete-btn" @click="handleConvoDelete(conversation, index)">Delete</button>
        </div>
    </div>
</template>

<script setup>
import { conversations, Conversation } from '@/states/conversation';
import { Message, messages } from '@/states/message';
import { conversationIdRef } from '@/states/user';
import { nextTick, useTemplateRef } from 'vue';

const choseConvo = async (conversation) => {
    messages.value = conversation.messages
    conversationIdRef.value = conversation.id;
    if (conversation.messages.length === 0 && conversation.id) {
        let conversationId = conversation.id;        // conversationId = newConvoId.value;
        const token = localStorage.getItem('token');
        const response = await fetch(`http://scj.dolmo.top:3001/api/conversations/${conversationId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        messages.value = data.data.messages.map((message) => new Message(
            message['content'],
            message['created_at'],
            message['role'],
            message['images'].map((image) => image.url)))
        conversation.messages = messages.value
    }
}

const convoListRef = useTemplateRef('convoList')

const createNewConvo = async () => {
    conversations.value.push(new Conversation(null, `newConvo${conversations.value.length + 1}`))
    await nextTick();
    convoListRef.value[convoListRef.value.length - 1].click()
}

const handleConvoDelete = async (conversation, index) => {
    const conversationId = conversation.id
    conversations.value.splice(index, 1);
    const token = localStorage.getItem('token');
    const response = await fetch(`http://scj.dolmo.top:3001/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
}


defineExpose({ choseConvo })
</script>

<style scoped>
.container {
    display: flex;
    flex-direction: column;
}
</style>