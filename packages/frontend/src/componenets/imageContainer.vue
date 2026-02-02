<template>
    <div :style="`--size:${size}`" style="position: relative;" ref="imageContainer" @mouseenter="showDeleteBtn = true"
        @mouseleave="showDeleteBtn = false">
        <div v-if="enableDeleteBtn" v-show="showDeleteBtn" class="deleteBtn" @click="onDelete">x</div>
        <TransitionGroup :name="`${enableLoadingAnimation ? 'wait-image' : ''}`">
            <div class="waitBlock" :class="{ hidden: enableLazyLoad }" v-if="!isLoaded && enableLoadingAnimation"
                :key="`${imageUrl}-waitBlock`">
                <div class="spinner"></div>
            </div>
            <img :src="`${enableLazyLoad ? '' : imageUrl}`" class="imageBlock" v-show="isLoaded"
                :key="`${imageUrl}-imageBlock`" @load="onImageLoaded" :lazySrc="`${enableLazyLoad ? imageUrl : ''}`" />
        </TransitionGroup>
    </div>
</template>

<script setup>
import observer from '@/composiables/observer';
import { onMounted, ref } from 'vue';

const props = defineProps({
    imageUrl: {
        type: String,
        required: true,
    },
    size: {
        type: String,
        default: '80px'
    },
    enableLoadingAnimation: {
        type: Boolean,
        default: false
    },
    enableLazyLoad: {
        type: Boolean,
        default: false
    },
    enableDeleteBtn: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['onImageLoaded', 'onImageDeleted'])
const isLoaded = ref(false)
const onImageLoaded = () => {
    isLoaded.value = true
    emit('onImageLoaded')
}

const onDelete = () => {
    emit('onImageDeleted')
}

const enableLazyLoad = props.enableLazyLoad;
const imageContainer = ref(null)
onMounted(() => {
    if (enableLazyLoad) observer.observe(imageContainer.value)
})

const showDeleteBtn = ref(false)
</script>

<style scoped>
.waitBlock {
    width: var(--size);
    height: var(--size);
    border: none;
    border-radius: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.imageBlock {
    min-width: var(--size);
    width: var(--size);
    height: var(--size);
    object-fit: cover;
    border: none;
    border-radius: 5px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.spinner {
    width: calc(var(--size)/2);
    height: calc(var(--size)/2);
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.wait-image-enter-active {
    transition: opacity 1s ease;
}

.wait-image-leave-active {
    transition: opacity 0.5s ease;
    position: absolute;
}

.wait-image-enter-from,
.wait-image-leave-to {
    opacity: 0;
}

.hidden {
    display: none;
}

.deleteBtn {
    position: absolute;
    width: 25px;
    height: 25px;
    border-radius: 15px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    display: flex;
    justify-content: center;
}
</style>
