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
                <!-- 有兜底图：主图加载失败时自动切换到 fallback -->
                <img v-if="resolvedSrc && resolvedFallback"
                    :src="useFallback ? resolvedFallback : resolvedSrc"
                    class="imageBlock" v-show="isLoaded"
                    :key="`${imageUrl}-imageBlock-${useFallback}`"
                    @load="onImageLoaded"
                    @error="onMainImageError" />
                <!-- 无兜底图：直接 <img>（本地预览 / GIF / 旧数据） -->
                <img v-else-if="resolvedSrc" :src="resolvedSrc" class="imageBlock" v-show="isLoaded"
                    :key="`${imageUrl}-imageBlock`" @load="onImageLoaded" />
            </TransitionGroup>
        </div>
    </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { getCachedImage, getCachedImageSync } from '@/composables/useImageCache.js';

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
const resolvedSrc = ref(null)
const resolvedFallback = ref(null)
const useFallback = ref(false)

const onImageLoaded = () => {
    isLoaded.value = true
    emit('onImageLoaded')
}

const onMainImageError = () => {
    if (!useFallback.value && resolvedFallback.value) {
        useFallback.value = true
    }
}

const onDelete = () => {
    emit('onImageDeleted')
}

const imageContainer = ref(null)
const showDeleteBtn = ref(false)
let lazyObserver = null

async function loadImage() {
    if (!props.imageUrl) return

    // 先同步检查缓存，有的话直接用（不闪 loading）
    const cached = getCachedImageSync(props.imageUrl)
    if (cached) {
        resolvedSrc.value = cached
        if (props.fallbackUrl) {
            resolvedFallback.value = getCachedImageSync(props.fallbackUrl) || await getCachedImage(props.fallbackUrl)
        }
        return
    }

    // 没有缓存，fetch 并缓存为 blob URL
    const blobUrl = await getCachedImage(props.imageUrl)
    resolvedSrc.value = blobUrl
    if (props.fallbackUrl) {
        resolvedFallback.value = await getCachedImage(props.fallbackUrl)
    }
}

onMounted(() => {
    if (!props.imageUrl) return

    // 如果已有缓存，直接同步使用，不需要 observer
    const cached = getCachedImageSync(props.imageUrl)
    if (cached) {
        resolvedSrc.value = cached
        if (props.fallbackUrl) {
            const cachedFb = getCachedImageSync(props.fallbackUrl)
            if (cachedFb) {
                resolvedFallback.value = cachedFb
            } else {
                getCachedImage(props.fallbackUrl).then(url => { resolvedFallback.value = url })
            }
        }
        return
    }

    // 没有缓存 → 用 IntersectionObserver 实现真正的懒加载
    lazyObserver = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    lazyObserver.unobserve(entry.target)
                    lazyObserver = null
                    loadImage()
                    break
                }
            }
        },
        { rootMargin: '200px' }
    )
    lazyObserver.observe(imageContainer.value)
})

onUnmounted(() => {
    if (lazyObserver && imageContainer.value) {
        lazyObserver.disconnect()
        lazyObserver = null
    }
})
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
