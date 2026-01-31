<<template>
  <h1><span v-for="(value, index) in arr">{{ value.value.toString().padStart(2, '0') }}{{
    index !== 2 ? ':' : '' }}</span>:{{ showMs.toString().padStart(3, '0') }}</h1>
  <button @click="pauseTime">{{ stateTime ? 'PLAY' : 'PAUSE' }}</button>
</template>

  <script setup>
  // 时、分、秒排列显示正计时
  import { ref } from 'vue';
  
  const arr = Array.from({ length: 3 }, () => ref(0))
  let showMs = ref(0);
  const stateTime = ref(true);
  let starter = Date.now()
  let newTime = starter;
  let requestAnimationFrameEvent;


  const logic = () => {
    const nodeTime = Date.now()
    showMs.value = nodeTime - starter;
    if (nodeTime - starter >= 1000) {
      showMs.value -= 1000;
      arr[2].value++
      starter = nodeTime
      for (let i = arr.length - 1; i > 0; i--) {
        if (arr[i].value >= 60) {
          arr[i - 1].value++
          arr[i].value = 0
        }
      }
    }
  }
  const fn = () => {
    logic()
    requestAnimationFrameEvent = requestAnimationFrame(fn)
  }
  const pauseTime = () => {
    stateTime.value = !stateTime.value;
    if (!stateTime.value) {
      starter += Date.now() - newTime
      requestAnimationFrameEvent = requestAnimationFrame(fn)
    }
    else {
      newTime = Date.now()
      cancelAnimationFrame(requestAnimationFrameEvent)
    }
  }
</script>

  <style scoped lang='scss'></style>
