import "abortcontroller-polyfill";
import { createApp } from 'nativescript-vue';
import { VueQueryPlugin } from '@tanstack/vue-query'
import { init } from '@org/nativescript-utils';

import App from './components/App.vue';

// init settings
init();

createApp(App).use(VueQueryPlugin).start();
