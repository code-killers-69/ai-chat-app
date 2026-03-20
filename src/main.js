import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

import MyLazykitt from 'my-lazy-kitt';
const app = createApp(App);

const pinia = createPinia();
app.use(pinia);

app.use(MyLazykitt, {
  rootMargin: '0px',
  threshold: 0,
  lruMax: 150,
  loading: '/Users/chengtianran/Desktop/chatapp/public/gif/loading.gif',
});
app.mount('#app');
