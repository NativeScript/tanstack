## 0.2.2 (2026-11-24)

### 🩹 Fixes

- Links that only navigated on the first tap: router changes that arrived while the Frame sync was locked were dropped, so re-opening a modal after closing it (or navigating during a back transition) did nothing.
- Android hardware back after closing a modal route: closing a modal (Close link, Android back, iOS sheet swipe) now pops its history entry when it was pushed over the same page, instead of leaving a duplicate entry that swallowed the next Back.
- A modal route linked from another page (e.g. `/posts?@modal=/users/3` from `/`) opened twice on Android. Modals now open once their page is visible, and cancelled opens never present.
- Android back while a modal is presented is handled by the dialog, so it closes the modal like the iOS sheet swipe-down.
- `replace` navigations now drop the replaced page from the Frame backstack, and router back targets the matching backstack page even across several history entries.
- A tap made while a page was still animating in is no longer reverted when that page's transition finishes.

## 0.2.1 (2026-11-23)

The 0.2.0 tarball on npm was built before the following changes landed; 0.2.1 publishes them.

### ⚠️ Breaking Changes

- `nativescript.vite.mjs` no longer registers the TanStack router plugin, and `@tanstack/router-plugin` is no longer a dependency. Apps using file-based routes add `tanstackRouter({ target: 'solid', autoCodeSplitting: false })` from `@tanstack/router-plugin/vite` to their own Vite config. With `@nativescript/vite` applying dependency plugins, shipping it here would register the plugin twice.

### 🩹 Fixes

- Modal routers no longer replace the app router registered on `globalThis.__ns_router`, so HMR keeps patching the live router after a modal opens.
- `scrollTo` is stubbed as a no-op global: router-core resets window scroll after every render and threw `ReferenceError: scrollTo is not defined` on each navigation.
- The provider's navigation signal is seeded without a top-level reactive read (no `STRICT_READ_UNTRACKED` dev warnings).

## 0.2.0 (2026-11-23)

### ⚠️ Breaking Changes

- The Solid flavor now targets Solid 2 only: `solid-js` 2.x, `@solidjs/web` 2.x, `@nativescript-community/solid-js` 2.x and `@tanstack/solid-router` 2.x (`>=2.0.0-rc.12`). Solid 1 is no longer supported.
- `NativeScriptRouterProviderProps.actionBar` and `Link`'s `children` are typed with Solid 2's `Element` instead of `JSX.Element`.
- `solid-js-jsx-runtime-shim.js` is no longer shipped; the Solid sources are compiled without JSX.
- `nativescript.vite.mjs` no longer registers the TanStack router plugin, and `@tanstack/router-plugin` is no longer a dependency. Apps using file-based routes add `tanstackRouter({ target: 'solid', autoCodeSplitting: false })` from `@tanstack/router-plugin/vite` to their own Vite config.

### 🚀 Features

- `solid-web-shim.js` now stands in for `@solidjs/web` (aliased by `nativescript.vite.mjs` and `nativescript.webpack.js`), binding the router's renderer helpers (`insert`, `spread`, `effect`, `memo`, `Dynamic`, ...) to the universal renderer of `@nativescript-community/solid-js`.
- React flavor updated to `@tanstack/react-router` 1.170 / `@tanstack/router-core` 1.171.

### 🩹 Fixes

- Pages render under `Errored` and keep their views through the native pop animation while their reactivity is torn down.
- Initial and history-driven loads run outside Solid owners, and Frame navigation runs after (not inside) the navigation effect, as Solid 2 requires.
- Modal routers no longer replace the app router registered on `globalThis.__ns_router`, so HMR keeps patching the live router after a modal opens.
- `scrollTo` is stubbed as a no-op global: router-core resets window scroll after every render and threw `ReferenceError: scrollTo is not defined` on each navigation.

### 🔧 Chores

- Drop solid-refresh proxy unwrapping from the HMR remount path; `@nativescript/vite` patches route components directly.

## 0.1.2 (2026-05-03)

### 🧪 Tests

- Add `transitioner-equivalent.test.ts`, `ns-render-via-shim.test.ts`, and `router-render.test.ts` covering the pending→idle settle path and the universal renderer + shim end-to-end render through `getRouteApi('/').useLoaderData()` against `@tanstack/solid-router` `1.169.x`.

## 0.1.1 (2026-05-03)

### 🩹 Fixes

- Fix `solid-web-shim.js` `memo()` to wrap in `createMemo` (parity with `solid-js/web`).
- Replace manual `router.stores.status.set('idle')` and `resolvedLocation.set(...)` handling in `NativeScriptRouterProvider` with a Transitioner-equivalent `createEffect` that watches `isLoading || hasPending` and settles the router via `batch(...)` exactly like `@tanstack/solid-router`'s internal `<Transitioner />`.

### ❤️ Thank You

- Nathan Walker

## 0.1.0 (2026-05-03)

### 🚀 Features

- tanstack router updates ([#1](https://github.com/NativeScript/tanstack/pull/1))

### 🩹 Fixes

- publishing format for better compat across non-hmr and hmr ([9d69f20](https://github.com/NativeScript/tanstack/commit/9d69f20))

### ❤️ Thank You

- Nathan Walker

## 0.0.8 (2026-03-23)

### 🩹 Fixes

- compat with latest 1.168+ tanstack ([5093a18](https://github.com/NativeScript/tanstack/commit/5093a18))

### ❤️ Thank You

- Nathan Walker

## 0.0.5 (2026-03-13)

### 🚀 Features

- support file based routes ([55e141e](https://github.com/NativeScript/tanstack/commit/55e141e))

### ❤️ Thank You

- Nathan Walker

## 0.0.4 (2026-03-09)

### 🩹 Fixes

- android modal handling ([361581f](https://github.com/NativeScript/tanstack/commit/361581f))

### ❤️ Thank You

- Nathan Walker

## 0.0.3 (2026-03-08)

### 🚀 Features

- improve route type safety ([8bb05ba](https://github.com/NativeScript/tanstack/commit/8bb05ba))

### ❤️ Thank You

- Nathan Walker

## 0.0.2 (2026-03-08)

### 🚀 Features

- support vite ([5598804](https://github.com/NativeScript/tanstack/commit/5598804))
- improve deterministic page navigation handling ([c0cb80d](https://github.com/NativeScript/tanstack/commit/c0cb80d))

### ❤️ Thank You

- Nathan Walker