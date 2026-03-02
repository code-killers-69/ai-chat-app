import { createApp } from 'vue';
import App from './App.vue';
import { VueLazyLoad } from '@code-killer/vue-lazy-load';

createApp(App).use(VueLazyLoad, { rootMargin: '200px' }).mount('#app');
