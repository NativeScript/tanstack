import type { AnyRouter } from '@tanstack/solid-router';
import { normalizeRenderableComponent } from './component-shape';

type NsSolidHmrEvent = {
  kind: 'solid';
  changedFiles: string[];
  boundaries: string[];
};
type NsSolidHmrUnsubscribe = () => void;
type NsSolidHmrSubscribe = (fn: (ev: NsSolidHmrEvent) => void) => NsSolidHmrUnsubscribe;

export interface SolidHmrRemountOptions {
  router: AnyRouter;
  getFrame: () => any;
  getActiveModalPage?: () => any;
  getActiveModalPath?: () => string | null | undefined;
  log: (...args: any[]) => void;
}

// Translate a TanStack file-based route boundary path
// (e.g. `/src/routes/posts.$postId.tsx`) to its TanStack `fullPath`
// (`/posts/$postId`). Used to look up the route's freshly-patched
// component (set by the NS HMR client during boundary re-import) when a
// route file is the one that changed.
function boundaryToFullPath(bid: string): string | null {
  const m = bid.match(/\/src\/routes\/(.+)\.(tsx|jsx|ts|js)$/i);
  if (!m) return null;
  let p = m[1];
  p = p.replace(/\./g, '/');
  if (p === 'index') return '/';
  if (p.endsWith('/index')) p = p.slice(0, -6);
  p = p.replace(/(^|\/)-([\w])/g, '$1$2');
  return '/' + p;
}

// The root route (`__root__`) shares fullPath '/' with the index route, so
// prefer the non-root (leaf) match — otherwise an `index.tsx` edit would read
// the root layout's component instead of the page's. The NS HMR client patches
// `route.options.component` using the same preference, so patch + read here
// resolve to the same route.
function findRouteByFullPath(router: any, fullPath: string): any | null {
  const byId = router?.routesById;
  if (!byId) return null;
  let rootMatch: any | null = null;
  for (const rid of Object.keys(byId)) {
    const r = byId[rid];
    if (r?.fullPath !== fullPath) continue;
    if (rid === '__root__') {
      rootMatch = rootMatch || r;
      continue;
    }
    return r;
  }
  return rootMatch;
}

// Resolve a solid-refresh proxy chain down to the underlying user component
// function. solid-refresh wraps every component in a `createProxy`-returned
// Proxy whose `HMRComp` body returns `createMemo(() => source()(props))`.
// On HMR, `patchComponent` rewrites M_save_X.signal.value = M_initial.proxy
// and M_initial.signal.value = newHomeFn, so calling M_save_X.proxy(props)
// goes M_save_X.proxy → OUTER memo → M_initial.proxy → INNER memo → newHomeFn.
//
// The nested memo chain is the source of "every other save applies": each
// remount's INNER memo subscribes to M_initial.source, and on patch the
// previous mount's INNER memos (still subscribed because the disposal
// behavior under universal-renderer + nested context provider isn't fully
// torn down before the next patch) re-evaluate, producing zombie renders
// that fight the fresh mount's renderEffect.
//
// By unwrapping the proxy chain HERE — before passing to `__ns_remount` —
// we hand the page the freshly-evaluated user function directly. The page's
// `createComponent(fn, {})` then runs `fn({})` without any HMRComp memos.
// Each save's mount is a clean, single-pass render with no signal-based
// reactivity to share with previous mounts. solid-refresh's patchRegistry
// still updates the registry (so other consumers that hold the proxy
// reference also see fresh behavior), but our page mount is decoupled.
//
// Each call to source() returns either another solid-refresh proxy
// (recurse) or the underlying user function (terminate).
function unwrapSolidRefreshProxy(value: any, log: (...a: any[]) => void): any {
  if (typeof value !== 'function') return value;
  let current: any = value;
  let hops = 0;
  // The escape hatch is `__$ns_resolveSource` (NOT `__$$ns_resolveSource`):
  // Vite's plugin patches solid-refresh via String.prototype.replace, where
  // `$$` in the replacement is a literal `$`. We use a single `$` to avoid
  // that footgun.
  while (typeof current?.__$ns_resolveSource === 'function' && hops < 8) {
    try {
      const next = current.__$ns_resolveSource();
      if (typeof next !== 'function' || next === current) break;
      current = next;
      hops++;
    } catch (err) {
      log('[NSRouter][hmr] unwrapSolidRefreshProxy error at hop', hops, err);
      break;
    }
  }
  log('[NSRouter][hmr] unwrap', 'name=', (value as any)?.name, 'hops=', hops, 'finalName=', (current as any)?.name);
  return current;
}

// Ask a Page (rendered by `PageRenderer.renderPage`) to dispose its current
// Solid tree and remount with `nextComponent` as the route component. When
// `nextComponent` is undefined, the page reuses its existing component
// reference — which for solid-refresh is the proxy, whose internal signal
// has already been swapped by `patchRegistry` so a fresh render emits the
// updated body. Pages render through the same RouterContextProvider /
// ErrorBoundary chain, so a remount picks up the freshest behavior without
// a Frame.navigate (no backstack churn, no native page transition).
function remountPage(page: any, nextComponent: any, log: (...a: any[]) => void): boolean {
  if (!page || typeof page.__ns_remount !== 'function') {
    return false;
  }
  try {
    page.__ns_remount(nextComponent);
    log('[NSRouter][hmr] remounted page', page.__nsRouterPath || '(unknown path)');
    return true;
  } catch (err) {
    log('[NSRouter][hmr] remount failed', err);
    return false;
  }
}

// Collect every Page currently held by the Frame (currentPage + backStack
// entries). NS Frame's backStack shape varies across runtimes/versions:
// some expose Page directly, others wrap each entry in
// { entry, resolvedPage } or `{ resolvedPage }`. We probe defensively so a
// minor shape change in @nativescript/core doesn't silently break HMR.
function collectFramePages(frame: any): any[] {
  if (!frame) return [];
  const pages: any[] = [];
  if (frame.currentPage) pages.push(frame.currentPage);
  const backStack = (frame as any).backStack;
  if (Array.isArray(backStack)) {
    for (const item of backStack) {
      if (!item) continue;
      if (item.tagName === 'page' || item.constructor?.name?.toLowerCase().includes('page')) {
        pages.push(item);
      } else if (item.entry?.resolvedPage) {
        pages.push(item.entry.resolvedPage);
      } else if (item.resolvedPage) {
        pages.push(item.resolvedPage);
      }
    }
  }
  return pages;
}

// Subscribe to the NS HMR client's Solid completion event and trigger a
// page-level remount whenever a Solid HMR cycle finishes. Returns a cleanup
// function that unsubscribes from the HMR event stream.
//
// Strategy: when ANY .tsx file changes (route OR component), every Page held
// by the Frame is remounted. We don't try to map "which file changed" to
// "which page depends on it" — `solid-refresh` already swapped the proxy
// signals globally, so a fresh render of any page automatically picks up the
// latest component bodies. Remounting unaffected pages is a few-millisecond
// no-op cost, and avoiding the dependency analysis means HMR Just Works for
// edits to shared components, hooks, utilities, etc., not just route files.
//
// For route-file edits we do prefer to pass the freshly-patched component
// reference explicitly (rather than reusing the existing proxy ref) so that
// any deep-equality checks downstream see a different identity.
//
// If the NS HMR client is not present (production builds, tests, or older
// runtimes that don't expose `__ns_solid_hmr_subscribe`), this is a no-op
// and returns a no-op cleanup.
// Resolve (or lazily create) the shared globalThis-stored listener Set used
// by the NS HMR client. By using the same Set the HMR client iterates at
// emit time, we sidestep module-instance / realm mismatches that can occur
// in NativeScript when the HMR client and user-app modules load via
// different paths (HTTP loader vs bundled vendor realm).
function resolveSharedListenerSet(): Set<(ev: NsSolidHmrEvent) => void> {
  const g = globalThis as any;
  let set = g.__ns_solid_hmr_listener_set as Set<(ev: NsSolidHmrEvent) => void> | undefined;
  if (!set) {
    set = new Set<(ev: NsSolidHmrEvent) => void>();
    g.__ns_solid_hmr_listener_set = set;
  }
  return set;
}

export function subscribeSolidHmrRemount(opts: SolidHmrRemountOptions): NsSolidHmrUnsubscribe {
  const { router, getFrame, getActiveModalPage, getActiveModalPath, log } = opts;
  const g = globalThis as any;

  log('[NSRouter][hmr] subscribeSolidHmrRemount globalSubscribe=', typeof g.__ns_solid_hmr_subscribe, 'listenerSet=', typeof g.__ns_solid_hmr_listener_set);

  const listener = (ev: NsSolidHmrEvent) => {
    log('[NSRouter][hmr] event changedFiles=', ev.changedFiles, 'boundaries=', ev.boundaries);
    try {
      const tsxChanged = ev.changedFiles.filter((id) => /\.(tsx|jsx)$/i.test(id));
      if (tsxChanged.length === 0 && ev.boundaries.length === 0) {
        log('[NSRouter][hmr] no .tsx/.jsx changes; skipping remount');
        return;
      }

      // Build a routePath → freshly-patched component map for any changed
      // route files (under /src/routes/). Used as `nextComponent` hint when
      // remounting pages that match those paths.
      const routePathToComponent = new Map<string, any>();
      for (const bid of [...tsxChanged, ...ev.boundaries]) {
        const fullPath = boundaryToFullPath(bid);
        if (!fullPath) continue;
        const route = findRouteByFullPath(router, fullPath);
        const rawComp = normalizeRenderableComponent(route?.options?.component);
        // Unwrap the solid-refresh proxy chain so the page mount calls the
        // freshly-loaded user function directly. See unwrapSolidRefreshProxy
        // for full reasoning — this is the fix for "every other save applies".
        const Comp = unwrapSolidRefreshProxy(rawComp, log);
        if (Comp) routePathToComponent.set(fullPath, Comp);
      }

      const frame = getFrame();
      const pages = collectFramePages(frame);

      let remounted = 0;
      for (const page of pages) {
        const path = page?.__nsRouterPath;
        const nextComponent = path ? routePathToComponent.get(path) : undefined;
        if (remountPage(page, nextComponent, log)) remounted++;
      }

      // Modal pages live outside the Frame. Remount any active modal too so
      // its tree picks up the edit.
      try {
        const modalPage = getActiveModalPage?.();
        const modalPath = getActiveModalPath?.();
        if (modalPage) {
          const nextComponent = modalPath ? routePathToComponent.get(modalPath) : undefined;
          remountPage(modalPage, nextComponent, log);
        }
      } catch (err) {
        log('[NSRouter][hmr] modal remount failed', err);
      }

      log('[NSRouter][hmr] event handled. tsxChanged=', tsxChanged.length, 'pages=', pages.length, 'remounted=', remounted);
    } catch (err) {
      log('[NSRouter][hmr] handler failed', err);
    }
  };

  // Prefer subscribing through the published global API so the HMR client
  // can do its own bookkeeping (count logs, etc.). Fall back to writing
  // directly into the shared global Set when the API isn't there yet —
  // that path still works because the HMR client iterates the same Set
  // at emit time.
  const subscribe = g.__ns_solid_hmr_subscribe as NsSolidHmrSubscribe | undefined;
  if (typeof subscribe === 'function') {
    log('[NSRouter][hmr] subscribed via global __ns_solid_hmr_subscribe');
    return subscribe(listener);
  }

  const set = resolveSharedListenerSet();
  set.add(listener);
  log('[NSRouter][hmr] subscribed via shared listener set (fallback). size=', set.size);
  return () => set.delete(listener);
}
