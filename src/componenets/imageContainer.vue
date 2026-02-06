<template>
    <div ref="rootEl" :class="{ haveLoadingAnimation: enableLoadingGif }" :style="{ '--size': size + 'px' }">
       <div class="loadingAnimation" v-if="enableLoadingGif && !isLoaded"> <!--  删掉！ -->
            <img src="/gif/loading.gif" alt="loading">
        </div>
        <img class='imageBlock noLoading' :src="imageUrl" @load="onLoaded">
    </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
    imageUrl: {
        type: String,
        required: true
    },
    enableLoadingGif: {
        type: Boolean,
        default: false
    },
    size: {
        type: Number,
        default: 80
    }
})
const emit = defineEmits(['onImageLoaded'])
const isLoaded = ref(false)
const onLoaded = () => {
    isLoaded.value = true;
    emit('onImageLoaded')
}
</script>

<style scoped>
.haveLoadingAnimation {
    position: relative;
    display: flex;
    max-width: 200px;
    min-width: 120px;
    overflow: scroll;
    scrollbar-width: none;
}

.loadingAnimation {
    position: relative;
    margin: 0 2px;
    border-radius: 5px;
}

.loadingAnimation img {
    min-width: var(--size);
    height: var(--size);
    margin: 0 auto;
    border-radius: 5px
}

.noLoading {
    max-width: var(--size);
    margin: 5px 0;
    border-radius: 10px;
}

.haveLoading {
    position: absolute;
    top: 0;
    left: 0;
    min-width: 100px;
    height: 100px;
    margin: 0 2px;
    border-radius: 5px;
    transition: all 0.4s ease;
    object-fit: cover;
}
</style>
