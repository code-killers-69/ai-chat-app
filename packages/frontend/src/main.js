import { createApp } from 'vue'
import App from './App.vue'
import { VueLazyLoad } from '@chat-app/vue-lazy-load'

createApp(App).use(VueLazyLoad, { rootMargin: '200px' }).mount('#app')
