import { ref } from 'vue';

class Conversation {
  messages = [];
  constructor(id, title, createdAt, updatedAt) {
    this.id = id;
    this.title = title;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
const conversations = ref([]);
export { Conversation, conversations };
