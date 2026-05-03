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