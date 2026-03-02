<template>
    <div class="container">
        <button class="createNewConvo" @click="handleConvoCreate">New Convo</button>
        <div class="conversation" v-for="(conversation, index) in conversations"
            @click="choseConvoHandler(conversation)" style="display: flex;"
            :class="{ selected: conversation.id == conversationIdRef }" :key="conversation.id || index">
            <div class="title">
                {{ conversation.title }}
            </div>
            <button class="title-change-btn" @click.stop="shareIndexHandler(index)">change</button>
            <button class="delete-btn" @click.stop="handleConvoDelete(conversation, index)">Delete</button>
        </div>
        <input type="text" v-model="newTitle" v-show="showTitleEditor" @keypress="handleTitleChange">
    </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import getFetch from '@/utils/getFetch';
import { storeToRefs } from 'pinia';
import { useMessageStore, Message } from '@/states/message';
import { useConvoStore, Conversation } from '@/states/conversation';

const convoStore = useConvoStore()
const messageStore = useMessageStore()

const { conversations, conversationIdRef } = storeToRefs(convoStore)
const { haveNewMessage, messages, fetchCount } = storeToRefs(messageStore)
const firstMessageId = ref(0);

const choseConvoHandler = async (conversation) => {
    //  空对话判断
    if (!conversation) return
    conversationIdRef.value = conversation.id

    // 首次请求
    if (conversation.messages.length === 0 && conversation.createdAt) {
        let conversationId = conversation.id;

        const data = await getFetch(`/api/conversations/${conversationId}/messages?limit=20`, true)
        firstMessageId.value = data.data.messages[0].id; // 首次请求的标记
        conversation.messages = data.data.messages.map((message) => new Message(
            message['content'],
            message['created_at'],
            message['role'],
            message['images'].map((image) => image.url)))
    }
    //  message常规请求 ！后置避免空赋值！
    messages.value = conversation.messages
}

// 监听哨兵是否触发，触发就请求一批历史消息
watch(fetchCount, async () => {
    const conversationId = conversationIdRef.value;
    const oldData = await getFetch(`/api/conversations/${conversationId}/messages?before=${firstMessageId.value}&limit=20`, true)

    // 如果没有历史消息可供加载就不允许请求
    if (oldData.data.messages[0]) {
        // 追踪标记
        firstMessageId.value = oldData.data.messages[0].id;
    } else {
        haveNewMessage.value = false
        console.error('加载完毕！');
    }

    // 新旧消息合并处理
    const oldMessageArray = oldData.data.messages.map((message) => new Message(
        message['content'],
        message['created_at'],
        message['role'],
        message['images'].map((image) => image.url)
    ));
    messages.value.unshift(...oldMessageArray);
})

//  新建convo:
const handleConvoCreate = () => {
    //  新建本地会话成员 id给默认值用来处理高亮，不然每个新对话都是null==null，都亮起来吧
    conversations.value.push(new Conversation(conversations.value.length, `newConvo${conversations.value.length + 1}`))
    //自动跳转到新convo
    const index = conversations.value.length - 1
    choseConvoHandler(conversations.value[index], index)
}

//  删除convo：
const handleConvoDelete = async (conversation, index) => {
    //  本地UI更新 和 数据处理
    conversations.value.splice(index, 1);
    choseConvoHandler(conversations.value[0], 0)
    //  远程删除
    const conversationId = conversation.id
    const data = await getFetch(`/api/conversations/${conversationId}`, true, { method: 'DELETE' })
    data.success ? console.log('成功删除') : console.log('删除失败');
}

//  修改title：
const showTitleEditor = ref(false)
const newTitle = ref('')
const titleIndex = ref(0)
const titleChoseIndex = ref(0)

//  获取选中修改的会话index
const shareIndexHandler = (index) => {
    titleChoseIndex.value = conversations.value[index].id
    showTitleEditor.value = true;
    newTitle.value = conversations.value[index].title
    titleIndex.value = index
}

//  标题编辑器接受index，处理本地和服务器的标题修改
const handleTitleChange = async (e) => {
    if (e.key !== 'Enter' || newTitle.value === '') return
    //  本地修改
    conversations.value[titleIndex.value].title = newTitle.value
    //  服务器修改
    const data = await getFetch(
        `/api/conversations/${titleChoseIndex.value}`,
        true,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: { title: `${newTitle.value}` }
        }
    )
    //  UI状态处理
    if (data.success) {
        newTitle.value = ''
        showTitleEditor.value = false;
        console.log('远程修改成功');
    } else {
        console.error('远程修改失败');
    }
}

defineExpose({ choseConvo: choseConvoHandler })
</script>

<style scoped>
.container {
    display: flex;
    flex-direction: column;
}

.selected {

    /* background-color: orangered; */
    color: rgb(135, 6, 10);
    font-weight: bolder;
}
</style>