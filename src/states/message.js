import { ref } from 'vue';
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
  content = ref('');
  constructor(content, time, role, imageUrls) {
    this.content.value = content;
    this.time = time;
    this.role = role;
    this.imageUrls = imageUrls;
  }
}

export { Message, useMessageStore };
