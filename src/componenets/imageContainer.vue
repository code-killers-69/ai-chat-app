<template>
    <div ref="rootEl" :class="{ haveLoadingAnimation: enableLoadingGif }">
        <div class="loadingAnimation" v-if="enableLoadingGif">
            <img src="/gif/loading.gif" alt="loading">
        </div>
        <img :class="{ noLoading: !enableLoadingGif, haveLoading: enableLoadingGif }"
            :src="(seeMeNow || enableLoadingGif) ? imageUrl : '/gif/loading.gif'">
    </div>

</template>

<script setup>
import { onMounted, ref } from 'vue'

const props = defineProps({
    imageUrl: {
        type: String,
        required: true
    },

    untitle: {
        type: Number
    },

    enableLoadingGif: {
        type: Boolean,
        default: false
    },
})

const seeMeNow = ref(false)
const rootEl = ref(null)
const nowSeeMe = () => {
    seeMeNow.value = true
}

onMounted(() => {
    if (rootEl.value) {
        rootEl.value.revealSelf = nowSeeMe
    }
})
defineExpose({ nowSeeMe })

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
    height: 100px;
    position: relative;
    width: 100px;
    margin: 0 2px;
    border-radius: 5px;
    background-color: rgb(164, 125, 171);
}

.loadingAnimation img {
    height: 100px;
    min-width: 100px;
    margin: 0 auto;
    border-radius: 5px
}

.noLoading {
    max-width: 200px;
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
