<template>
    <div class="message-bubble" :class="{
        yourStyle: message.role === 'assistant',
        myStyle: message.role === 'user',
    }">
        <div class="article-area">
            <Transition>
                <p id="streamer">{{ message.content }}</p>
            </Transition>
            <!-- 光标跳动 -->
            <!-- <div v-show="index == messages.length - 1"></div> -->
        </div>
        <ImageContainer v-for="imageUrl in message.imageUrls" :image-url="imageUrl" :enable-loading-gif="false"
            :key="imageUrl" :size="200">
        </ImageContainer>
        <div class="time-tag">
            <p id="index">{{ message.time }}</p>
        </div>
    </div>
</template>

<script setup>
import ImageContainer from './imageContainer.vue';
import { Transition } from 'vue';

const props = defineProps({
    message: {
        type: Object,
        required: true
    }
})
</script>

<style scoped>
* {
    padding: 0;
    margin: 0;
    box-sizing: border-box;
}

.message-bubble {
    overflow-anchor: none;
    padding: 10px;
    margin-bottom: 20px;
    border-radius: 10px;
    width: fit-content;
    max-width: 600px;
    display: flex;
    flex-direction: column;
}

.yourStyle {
    background-color: #e9eef6;
    margin-left: 40px;
}

.myStyle {
    background-color: greenyellow;
    margin-right: 40px;
    align-self: flex-end;
}

.yourStyle .time-tag {
    margin-left: auto;
}

.article-area {
    margin-bottom: 5px;
}

.time-tag {
    font-size: 0.6rem;
    font-weight: 700;
    opacity: 0.5;
}
</style>
