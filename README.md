**TanStack Query with NativeScript**

<img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSgos9rHiIGdMrOu6SHJK_I8yJ2x9MCQ_iZgA&usqp=CAU" width="100"/> 

<img src="https://raw.githubusercontent.com/NativeScript/artwork/main/logo/export/NativeScript_Logo_Wide_White_Blue_Rounded_Blue.png" width="200"/> 

Android and iOS apps using [TanStack Query](https://tanstack.com/query/latest) with Angular and Vue.

- [Setup](#setup)
- [Try TanStack Query](#try-tanstack-query)
- [What is This?](#what-is-this)

## Setup

Prerequisites:
- [NativeScript Environment Setup](https://docs.nativescript.org/environment-setup.html)
- node >=20 (recommend 22.1.x)

```bash
npm run clean
```

## Try TanStack Query

<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Angular_full_color_logo.svg/2048px-Angular_full_color_logo.svg.png" width="60"/>

```bash
npx nx run nativescript-query-ng:ios
```

<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1024px-Vue.js_Logo_2.svg.png?20170919082558" width="60"/>

```bash
npx nx run nativescript-query-vue:ios
```

## What is This?

An Nx workspace with Angular and Vue iOS & Android apps all utilizing TanStack Query while rendering natively to each platform.

The workspace combines npx workspaces with Nx to hoist dependencies where needed to share.

- Each app shares Resources from [here](tools/App_Resources).
- Each app's `nativescript.config.ts` configures the shared resources via the `appResourcesPath` property
