<template>
    <div :style="`--size:${size}`" class="image-wrapper" ref="imageContainer" @mouseenter="showDeleteBtn = true"
        @mouseleave="showDeleteBtn = false">
        <div v-if="enableDeleteBtn" v-show="showDeleteBtn" class="deleteBtn" @click="onDelete">x</div>
        <!-- 占位容器：始终保持固定尺寸，防止虚拟列表回滚时高度跳动 -->
        <div class="placeholder">
            <TransitionGroup name="fade-image">
                <div class="waitBlock" v-if="!isLoaded && enableLoadingAnimation" :key="`${imageUrl}-waitBlock`">
                    <div class="spinner"></div>
                </div>
                <img v-lazy="lazyBinding"
                    class="imageBlock" :class="{ 'image-hidden': !isLoaded }"
                    :key="`${imageUrl}-imageBlock`"
                    @load="onImageLoaded" />
            </TransitionGroup>
        </div>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
    imageUrl: {
        type: String,
        required: true,
    },
    fallbackUrl: {
        type: String,
        default: '',
    },
    size: {
        type: String,
        default: '80px'
    },
    enableLoadingAnimation: {
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

const lazyBinding = computed(() => {
    if (props.fallbackUrl) {
        return { src: props.imageUrl, fallback: props.fallbackUrl }
    }
    return props.imageUrl
})

const onImageLoaded = () => {
    isLoaded.value = true
    emit('onImageLoaded')
}

const onDelete = () => {
    emit('onImageDeleted')
}

const imageContainer = ref(null)
const showDeleteBtn = ref(false)
</script>

<style scoped>
.image-wrapper {
    position: relative;
}

/* 占位容器：始终保持固定尺寸 */
.placeholder {
    width: var(--size);
    height: var(--size);
    border-radius: 5px;
    overflow: hidden;
    position: relative;
    background-color: #f0f0f0;
    /* 固定尺寸容器，独立布局和绘制 */
    contain: layout paint;
}

.waitBlock {
    width: var(--size);
    height: var(--size);
    border: none;
    border-radius: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #f0f0f0;
}

.imageBlock {
    width: var(--size);
    height: var(--size);
    object-fit: cover;
    border: none;
    border-radius: 5px;
    /* 异步解码，不阻塞主线程 */
    decoding: async;
}

/* 图片未加载时：保持布局尺寸（IntersectionObserver 需要），但视觉不可见 */
.image-hidden {
    visibility: hidden;
    position: absolute;
    top: 0;
    left: 0;
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
    width: calc(var(--size) / 3);
    height: calc(var(--size) / 3);
    border: 3px solid #e0e0e0;
    border-top: 3px solid #999;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.fade-image-enter-active {
    transition: opacity 0.3s ease;
}

.fade-image-leave-active {
    transition: opacity 0.2s ease;
    position: absolute;
    top: 0;
    left: 0;
}

.fade-image-enter-from,
.fade-image-leave-to {
    opacity: 0;
}

.deleteBtn {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    width: 25px;
    height: 25px;
    border-radius: 15px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    display: flex;
    justify-content: center;
    cursor: pointer;
}
</style>
