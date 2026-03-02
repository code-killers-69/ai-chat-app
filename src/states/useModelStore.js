import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useModelStore = defineStore('model', () => {
  const modelIds = ref([]);
  const modelIdChosen = ref('Qwen/Qwen2.5-7B-Instruct');
  return { modelIds, modelIdChosen };
});
