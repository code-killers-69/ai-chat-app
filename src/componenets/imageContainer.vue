<template>
    <div :class="{ haveLoadingAnimation: enableLoadingGif }" :style="{ '--size': size + 'px' }">
        <div class="loadingAnimation" v-if="enableLoadingGif && !isLoaded">
            <img src="/gif/loading.gif" alt="loading">
        </div>
        <div class="imageBlock">
            <img class='noLoading' :src="imageUrl.webpUrl" @load="onLoaded" v-lazy="imageUrl.webpUrl">
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useImageUpload } from "@/composables/useImageUpload";

const { isCompressing } = useImageUpload()
const props = defineProps({
    imageUrl: {
        type: Object,
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
const isLoaded = ref(false)
const onLoaded = () => {
    isLoaded.value = true;
    console.log(isLoaded.value);
}
</script>

<style scoped>
.haveLoadingAnimation {
    position: relative;
    display: flex;
    max-width: 200px;
    min-width: 120px;
    overflow: scroll;
    width: var(--size);
    height: var(--size);
    scrollbar-width: none;
}

.loadingAnimation {
    position: absolute;
    margin: 0 2px;
    border-radius: 5px;
    width: var(--size);
    height: var(--size);
}

.loadingAnimation img {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
    margin: 0 auto;
    border-radius: 5px;

}

.noLoading {
    object-fit: cover;
    max-width: var(--size);
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
