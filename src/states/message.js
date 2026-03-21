import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';

const useMessageStore = defineStore('message', () => {
  const haveNewMessage = ref(true);
  const messages = ref([]);
  const fetchCount = ref(0);
  const allowWatch = ref(true);

  function $messageReset() {
    messages.value.length = 0;
  }

  return { messages, haveNewMessage, fetchCount, allowWatch, $messageReset };
});
class Message {
  // 使用 shallowRef 包裹一个对象，这样修改内层字符串时不会触发深度响应式监听
  contentObj = shallowRef({ text: '' });
  
  constructor(content, time, role, imageUrls) {
    this.contentObj.value.text = content;
    this.time = time;
    this.role = role;
    this.imageUrls = imageUrls;
  }
}

export { Message, useMessageStore };
