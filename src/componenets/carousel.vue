<template>
  <div class="container" v-if="source.length !== 0">
    <TransitionGroup :name="transitionName">
      <img v-for="(value, index) in source" :src="value" :key="value" v-show="index === activeIndex"
        style="width: 100%;height: 100%;object-fit: cover;">
    </TransitionGroup>

    <button class="left slide-button" @click="goLeft">left</button>
    <button class="right slide-button" @click="goRight">right</button>
    <div class="bottom-dds">
      <button v-for="(value, index) in source" :key="value" class="dd" :class="{ 'dd-active': index === activeIndex }"
        @click="showImage(index)"></button>
    </div>
  </div>
</template> 

<script setup>
import { ref, watch } from 'vue';
const activeIndex = ref(0);
const props = defineProps(['source']);
const source = props.source;
let intervalId;

const transitionName = ref('slide-right')

const goLeft = () => {
  activeIndex.value = activeIndex.value > 0 ? activeIndex.value - 1 : source.length - 1;
}

const goRight = () => {
  activeIndex.value = activeIndex.value < source.length - 1 ? 1 + activeIndex.value : 0
}

const showImage = (index) => {
  activeIndex.value = index
}

watch(activeIndex, (newActiveIndex, oldActiveIndex) => {
  transitionName.value = !(newActiveIndex === source.length - 1 && oldActiveIndex === 0) && newActiveIndex > oldActiveIndex || (newActiveIndex === 0 && oldActiveIndex === source.length - 1) ? 'slide-right' : 'slide-left'
  clearInterval(intervalId);
  intervalId = setInterval(() => {
    goRight()
  }, 3000);
}, { immediate: true })
</script>

<style scoped>
.container {
  width: 300px;
  height: 200px;
  position: relative;
  display: inline-block;
  overflow: hidden;
}

.slide-button {
  position: absolute;
  width: 40px;
  height: 40px;
  top: 50%;
  transform: translateY(-50%);
  border-radius: 20px;
  border-color: rgba(0, 0, 0, 0.4);
  background-color: rgba(0, 0, 0, 0.1);
  color: white;
}

.left {
  left: 5px;
}

.right {
  right: 5px;

}

.dd {
  width: 16px;
  height: 16px;
  border-radius: 8px;
  border: none;
  background-color: rgba(0, 0, 0, 0.4);
  margin: 0 2px;
}

.dd-active {
  background-color: rgba(0, 255, 255, 0.8);
}

.bottom-dds {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
}

.slide-right-enter-active,
.slide-right-leave-active,
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.5s ease;
  position: absolute;
}

.slide-right-enter-from {
  transform: translateX(100%);
}

.slide-right-leave-to {
  transform: translateX(-100%);
}

.slide-left-enter-from {
  transform: translateX(-100%);
}

.slide-left-leave-to {
  transform: translateX(100%);
}
</style>