<template>
  <h1><span v-for="item in arr">{{ item.value.toString().padStart(2, '0') }}:</span>{{ showMs.toString().padStart(3,
    '0')
  }}<br>
    <button @click="pauseTime">{{ stateTime ? "PLAY" : "PAUSE" }}</button>
    <button @click="resetTime">RESET</button>
  </h1>
</template>

<script setup>
import { ref } from 'vue';
const arr = Array.from({ length: 3 }, () => ref(0)) //
let starter;
let capTime = starter; //第一次抓取
let requestAnimationFrameEvent = 0;
let stateTime = ref(true);
let showMs = ref(0);

const logic = () => {
  const nodeTime = Date.now();
  starter = starter || nodeTime;
  showMs.value = nodeTime - starter
  if (nodeTime - starter >= 1000) {
    showMs.value -= 1000;
    arr[2].value++;
    starter = nodeTime;

    for (let i = arr.length - 1; i > 0; i--) {
      if (arr[i].value >= 60) {
        arr[i - 1].value++;
        arr[i].value = 0;
      }
    }
  }
}

const fn = () => {
  logic();
  requestAnimationFrameEvent = requestAnimationFrame(fn)
}

const pauseTime = () => {
  stateTime.value = !stateTime.value;
  if (!stateTime.value) {
    starter += Date.now() - capTime;// 补偿·
    requestAnimationFrameEvent = requestAnimationFrame(fn);
  } else {
    capTime = Date.now()
    cancelAnimationFrame(requestAnimationFrameEvent);
  }
}

const resetTime = () => {
  arr.forEach(item => item.value = 0);
  showMs.value = 0;
  starter = undefined;
}
</script>

<style scoped lang='scss'></style>
