import { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'org.nativescript.demosolid',
  appPath: 'src',
  appResourcesPath: '../../tools/assets/App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
  },
  cli: {
    packageManager: 'npm',
  },
} as NativeScriptConfig;
