<template>
    <div :style="`--size:${size}`">
        <TransitionGroup :name="`${enableLoadingAnimation ? 'wait-image' : ''}`">
            <div class="waitBlock" v-if="!isLoaded && enableLoadingAnimation" :key="`${imageUrl}waitBlock`">
                <div class="spinner"></div>
            </div>
            <img :src="imageUrl" class="imageBlock" v-show="isLoaded" :key="`${imageUrl}waitBlock`" ref="imageRef" />
        </TransitionGroup>
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
    imageUrl: {
        type: String,
        required: true,
    },
    enableLoadingAnimation: {
        type: Boolean,
        default: false
    },
    size: {
        type: String,
        default: '80px'
    }
})
const imageUrl = props.imageUrl;
const enableLoadingAnimation = props.enableLoadingAnimation;
const size = props.size;
const imageRef = ref(null)
const isLoaded = ref(false)
const emit = defineEmits(['onImageLoaded'])
onMounted(() => {
    imageRef.value.onload = () => {
        isLoaded.value = true
        emit('onImageLoaded')
    }
})
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
    width: 50px;
    height: 50px;
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
</style>
