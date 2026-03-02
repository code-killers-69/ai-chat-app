import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', () => {
  const userInfoRef = ref({});
  let token = ref('');

  function setToken(newToken) {
    token.value = newToken;
  }

  function $userReset() {
    localStorage.clear();
    userInfoRef.value = {};
    token.value = '';
  }
  return { token, userInfoRef, setToken, $userReset };
});
