import { ref } from 'vue';

const userInfoRef = ref({});
let token = '';
const setToken = (newToken) => {
  token = newToken;
};

const conversationIdRef = ref();
const newConvoId = ref([]);

export { conversationIdRef, token, userInfoRef, setToken, newConvoId };
