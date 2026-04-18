import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import Mylazykitt from 'my-lazy-kitt'

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(Mylazykitt, {
    rootMargin: '0px',
    threshold: 0,
    lruMax: 150,
    loading: '/Users/liz/Desktop/liz_chatApp/ai-chat-app/public/gif/loading.gif'
})
app.mount('#app');
