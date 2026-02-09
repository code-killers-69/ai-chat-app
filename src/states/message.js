import { ref } from 'vue';

class Message {
  constructor(content, time, role, imageUrls) {
    this.content = content;
    this.time = time;
    this.role = role;
    this.imageUrls = imageUrls;
  }
}
const messages = ref([]);
export { Message, messages };
