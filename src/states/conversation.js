import { ref } from 'vue';
import { defineStore } from 'pinia';
import getFetch from '@/utils/getFetch';
import { useUserStore } from './user';
import { storeToRefs } from 'pinia';

const useConvoStore = defineStore('convo', () => {
  const conversations = ref([]);
  const conversationIdRef = ref('');
  function $convoReset() {
    conversations.value.length = 0;
  }

  async function convoInit() {
    //  获取token
    const userStore = useUserStore();
    const { token } = storeToRefs(userStore);
    //  初始化
    if (token) {
      const data = await getFetch(`/api/conversations`, true);
      conversations.value = data.data.map(
        (conversion) =>
          new Conversation(
            conversion['id'],
            conversion['title'],
            conversion['created_at'],
            conversion['updated_at'],
          ),
      );
    }
  }
  return { conversations, conversationIdRef, $convoReset, convoInit };
});
class Conversation {
  messages = [];
  constructor(id, title, createdAt, updatedAt) {
    this.id = id;
    this.title = title;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

export { Conversation, useConvoStore };
