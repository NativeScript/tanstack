# @nativescript/tanstack-router

TanStack Router for NativeScript apps.

## Status

*Early Developer Preview*

Current framework support:

- `solid` via `@nativescript/tanstack-router/solid`

The package is structured to support any framework (`react`, `vue`, `svelte`, `angular`).

## Install

```bash
npm install @nativescript/tanstack-router @tanstack/solid-router @tanstack/history
```

Peer dependencies expected in the host app:

- `@nativescript/core`
- `@nativescript-community/solid-js`
- `solid-js`

## Import Paths

Use framework-scoped imports:

```ts
import { Link, createNativeScriptRouter } from '@nativescript/tanstack-router/solid'
```

## Quick Start (Solid)

```tsx
import {
  createNativeScriptRouter,
  createRootRoute,
  createRoute,
  NativeScriptRouterProvider,
} from '@nativescript/tanstack-router/solid'

const rootRoute = createRootRoute()

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: About,
})

const routeTree = rootRoute.addChildren([homeRoute, aboutRoute])

const router = createNativeScriptRouter({
  routeTree,
  initialPath: '/',
})

declare module '@nativescript/tanstack-router/solid' {
  interface Register {
    router: typeof router
  }
}

export function App() {
  return (
    <NativeScriptRouterProvider
      router={router}
      actionBarVisibility="always"
    />
  )
}
```

## Link Usage

```tsx
import { Link } from '@nativescript/tanstack-router/solid'

<Link to="/about">
  <label text="Go to About" />
</Link>

// Parameterized route (type-safe)
<Link to="/posts/$postId" params={{ postId: '123' }}>
  <label text="Open Post 123" />
</Link>
```

### Type Safety Notes

`Link` route typing is validated against your registered router when you add:

```ts
declare module '@nativescript/tanstack-router/solid' {
  interface Register {
    router: typeof router
  }
}
```

For parameterized routes, prefer route patterns + `params`:

- Use: `to="/posts/$postId"` with `params={{ postId: id }}`
- Avoid: ``to={`/posts/${id}`}``

With strict typing, invalid paths (for example `to="/invalid"`) produce TypeScript errors.

### Link Back Navigation

Use `back` to perform native-style stack pop (history back) instead of pushing to `to`.

```tsx
<Link back fallbackTo="/posts">
  <label text="Back to Posts" />
</Link>
```

Behavior:

- If history can go back: runs `router.history.back()`
- If history cannot go back: navigates to `fallbackTo`
- If `fallbackTo` is omitted and `to` is provided: navigates to `to`

### Query-Driven Modal Navigation (Single Modal)

The provider supports a single modal route encoded in search params, following
TanStack Router slot-RFC semantics:

`/posts?@modal=/users/123`

When `@modal` is present:

- The provider opens a NativeScript modal via `showModal()`
- The modal path is matched against your route tree (same route definitions)
- A modal-local router instance renders the modal route component

When `@modal` is removed:

- The provider closes the active NativeScript modal via `closeModal()`

If the user closes the modal natively, router search state is synced back by
removing `@modal`.

### Configurable Modal Presentation (Per Modal)

`NativeScriptRouterProvider` supports modal presentation configuration with
either:

- A static `modalOptions` object (applied to all modal routes), or
- A `modalOptions` resolver function (applied per modal route/path)

This is useful for choosing different iOS presentation styles and sheet
behavior for different modal routes.

```tsx
<NativeScriptRouterProvider
  router={router}
  modalOptions={({ modalPath, routeId }) => {
    if (routeId === '/users/$userId') {
      return {
        ios: {
          presentationStyle: UIModalPresentationStyle.PageSheet,
          detents: ['medium', 'large'],
          selectedDetent: 'medium',
          prefersGrabberVisible: true,
          preferredCornerRadius: 20,
          transparentBackgroundOnIOS26: true,
        },
      }
    }

    if (modalPath.startsWith('/full-screen-modal')) {
      return {
        fullscreen: true,
        ios: {
          presentationStyle: UIModalPresentationStyle.FullScreen,
          transparentBackgroundOnIOS26: false,
        },
      }
    }

    return undefined
  }}
/>
```

`modalOptions` supports:

- `animated?: boolean`
- `fullscreen?: boolean`
- `ios?: { ... }`
  - `presentationStyle?: number`
  - `detents?: ('medium' | 'large')[]`
  - `selectedDetent?: 'medium' | 'large'`
  - `prefersGrabberVisible?: boolean`
  - `prefersScrollingExpandsWhenScrolledToEdge?: boolean`
  - `prefersEdgeAttachedInCompactHeight?: boolean`
  - `preferredCornerRadius?: number`
  - `transparentBackgroundOnIOS26?: boolean`

You can set/remove `@modal` directly via `search`:

```tsx
<Link to="/posts" search={{ ['@modal']: '/users/123' }}>
  <label text="Open User Modal" />
</Link>
```

Or use optional `Link` helpers:

- `modalTo="/users/123"` to set `@modal`
- `closeModal` to clear `@modal`

### Link Custom Tap Override

Use `onTap` to run custom logic and optionally cancel default navigation by returning `false`.

```tsx
<Link
  to="/posts"
  onTap={() => {
    if (!canOpenPosts()) {
      return false // Skip default Link navigation
    }
  }}
>
  <label text="Open Posts" />
</Link>
```

## Debug Logging

Verbose internal router logs are disabled by default.

Enable them explicitly:

```tsx
<NativeScriptRouterProvider
  router={router}
  debug={true}
/>
```

## API Overview

### Root (`@nativescript/tanstack-router`)

- `createNativeScriptHistory`

### Solid (`@nativescript/tanstack-router/solid`)

NativeScript-specific:

- `createNativeScriptHistory`
- `createNativeScriptRouter`
- `NativeScriptRouterProvider`
- `Link`

Types:

- `NativeScriptModalDetent`
- `NativeScriptModalIOSPresentationOptions`
- `NativeScriptModalPresentationOptions`
- `NativeScriptModalOptionsResolver`
- `NativeScriptModalOptionsResolverContext`

Re-exported from `@tanstack/solid-router`:

- Route creation APIs (`createRootRoute`, `createRoute`, `createFileRoute`, etc.)
- Router APIs (`createRouter`, hooks, helper components)

## Notes

- The router uses memory history under the hood.
- Native back navigation is synchronized with router history.
- Route transitions are driven through NativeScript `Frame.navigate()` / `Frame.goBack()`.