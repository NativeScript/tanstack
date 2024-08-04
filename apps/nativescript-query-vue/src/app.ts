import "abortcontroller-polyfill";
import { createApp } from 'nativescript-vue';
import { VueQueryPlugin } from '@tanstack/vue-query'
import { init } from '@org/nativescript-utils';

import Posts from './components/Posts.vue';

// init settings
init();

createApp(Posts).use(VueQueryPlugin).start();
