import { createApp } from 'vue';
import App from './App.vue';
import { VueLazyLoad, LazyLoadPluginOptions } from '@code-killer/vue-lazy-load';

const lazyLoadOptions: LazyLoadPluginOptions = {
    rootMargin: '200px',
    loading: '/loading.gif',
    error: '/error.gif',
};
createApp(App).use(VueLazyLoad, lazyLoadOptions).mount('#app');