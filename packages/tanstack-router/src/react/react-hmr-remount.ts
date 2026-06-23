import type { AnyRouter } from '@tanstack/react-router';
import { normalizeRenderableComponent } from '../component-shape';

// React HMR per-page remount for NativeScript.
//
// React has no Fast Refresh / global component patching (unlike solid-refresh).
// So when a route file changes we must RE-IMPORT it ourselves, read the fresh
// `Route.options.component`, patch it onto the live router, and remount the
// matching Page(s) in place — no Frame.navigate (so no backstack churn / native
// transition, and the user keeps their place).
//
// Shell / non-route edits are handled by the app-runtime (`startReactApp`), which
// re-imports the app entry and re-renders the whole tree; this module deliberately
// ignores them.

export interface ReactHmrRemountOptions {
  router: AnyRouter;
  getFrame: () => any;
  log: (...args: any[]) => void;
}

type NsHmrUpdatePayload = { type?: string; version?: number; changedIds?: string[]; raw?: any };

const ROUTE_FILE_RE = /\/routes\/.+\.(?:tsx|jsx)$/i;
// `__root` is a layout route with no page component, and on device the web root
// (which `import`s app CSS) isn't a loadable ESM — exclude it from remount.
const ROOT_FILE_RE = /(^|[\\/])__root\.[a-z0-9]+$/i;

// `/src/routes/posts.$postId.tsx` → TanStack `fullPath` `/posts/$postId`.
function boundaryToFullPath(bid: string): string | null {
  const m = bid.match(/\/routes\/(.+)\.(?:tsx|jsx|ts|js)$/i);
  if (!m) return null;
  let p = m[1];
  p = p.replace(/\./g, '/');
  if (p === 'index') return '/';
  if (p.endsWith('/index')) p = p.slice(0, -6);
  p = p.replace(/(^|\/)-([\w])/g, '$1$2');
  return '/' + p;
}

// The root route (`__root__`) shares fullPath '/' with the index route; prefer the
// non-root (leaf) match so an `index.tsx` edit patches the page, not the layout.
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

// Every Page currently held by the Frame (currentPage + backStack). The backStack
// shape varies across @nativescript/core versions, so probe defensively.
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

function remountPage(page: any, nextComponent: any, log: (...a: any[]) => void): boolean {
  if (!page || typeof page.__ns_remount !== 'function') return false;
  try {
    page.__ns_remount(nextComponent);
    log('[NSRouter][hmr] remounted page', page.__nsRouterPath || '(unknown path)');
    return true;
  } catch (err) {
    log('[NSRouter][hmr] remount failed', err);
    return false;
  }
}

// Dev-server HTTP origin used to fetch app modules over the wire (mirrors the
// solid app-runtime's resolver).
function resolveOrigin(): string {
  try {
    const m = String(import.meta.url).match(/^https?:\/\/[^/]+/);
    if (m) return m[0];
  } catch {}
  const g = globalThis as any;
  if (typeof g.__NS_HTTP_ORIGIN__ === 'string' && /^https?:\/\//.test(g.__NS_HTTP_ORIGIN__)) return g.__NS_HTTP_ORIGIN__;
  if (typeof g.__NS_HMR_WS_URL__ === 'string') {
    const m = String(g.__NS_HMR_WS_URL__).match(/^wss?:\/\/([^/]+)/);
    if (m) return 'http://' + m[1];
  }
  return '';
}

const SCRIPT_EXT = /\.(?:tsx|ts|jsx|js|mjs)$/i;

// Monotonic per-save counter for cache-bust tags (see reimportRouteModule).
let importNonce = 0;

// Re-import a changed route file fresh (evicting its cached module first so any
// changed in-graph dependency is re-evaluated too), returning its module
// namespace (with the freshly-built `Route`). Returns null if it can't load.
async function reimportRouteModule(origin: string, changedIds: string[], fileId: string): Promise<any> {
  const spec = fileId.startsWith('/') ? fileId : '/' + fileId;
  const canonical = spec.replace(SCRIPT_EXT, '');
  // Cache-bust exactly as the proven solid app-runtime does (its
  // `installHmrRemount`), since both target the SAME native runtime:
  //   1. EVICT every URL form the module may be cached under (ext-less canonical,
  //      the original spec, and each script-extension variant) via
  //      `__nsInvalidateModules`, so V8 drops it from the module registry.
  //   2. RE-IMPORT through a `__ns_hmr__/<tag>/…?t=<tag>` URL whose tag is
  //      `Date.now()_<nonce>` — UNIQUE PER SAVE. This is the crux: a repeated
  //      tag hits the dev server's per-URL transform cache and serves the
  //      PREVIOUS save's output ("one edit behind"); a unique tag forces a fresh
  //      transform AND (after the runtime canonicalizes the tag away to the
  //      evicted canonical) a fresh V8 evaluation.
  const evict = new Set<string>();
  for (const raw of [spec, ...changedIds]) {
    if (!raw) continue;
    let s = String(raw).split('?')[0];
    if (!s.startsWith('/')) s = '/' + s;
    if (/(^|\/)node_modules\//.test(s)) continue;
    const c = s.replace(SCRIPT_EXT, '');
    evict.add(origin + '/ns/m' + c);
    if (s !== c) evict.add(origin + '/ns/m' + s);
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) evict.add(origin + '/ns/m' + c + ext);
  }
  const g = globalThis as any;
  const invalidate = g.__nsInvalidateModules;
  if (typeof invalidate === 'function') {
    try {
      invalidate(Array.from(evict));
    } catch {}
  }
  const t = `${Date.now()}_${++importNonce}`;
  const candidates = [`${origin}/ns/m/__ns_hmr__/r-${t}${canonical}?t=${t}`, `${origin}/ns/m${canonical}?t=${t}`, `${origin}/ns/m${spec}?t=${t}`];
  for (const url of candidates) {
    try {
      const mod: any = await import(/* @vite-ignore */ url);
      if (mod && mod.Route) return mod;
    } catch (err) {
      // try next candidate
    }
  }
  return null;
}

/**
 * Subscribe to the NS HMR client's app-level update hook and remount route Pages
 * in place when their files change. Returns an unsubscribe function.
 *
 * Wraps `globalThis.__NS_HMR_ON_UPDATE__` (the framework-agnostic hook the HMR
 * client invokes after each applied batch — see `@nativescript/vite`'s
 * `hmr/shared/runtime/hooks`), preserving any previously-installed hook.
 */
export function subscribeReactHmrRemount(opts: ReactHmrRemountOptions): () => void {
  const { router, getFrame, log } = opts;
  const g = globalThis as any;

  let running = false;
  const onUpdate = async (payload: NsHmrUpdatePayload) => {
    if (running) return;
    const changed = (payload?.changedIds || []).filter((id) => typeof id === 'string');
    const routeFiles = changed.filter((id) => ROUTE_FILE_RE.test(id) && !ROOT_FILE_RE.test(id));
    if (!routeFiles.length) {
      log('[NSRouter][hmr] no route-file changes; leaving to app-runtime');
      return;
    }
    const origin = resolveOrigin();
    if (!origin) {
      log('[NSRouter][hmr] no HTTP origin; cannot re-import route module');
      return;
    }
    running = true;
    try {
      const frame = getFrame();
      for (const fileId of routeFiles) {
        // Per-route isolation: one route's re-import failure must not abort the rest.
        try {
          const fullPath = boundaryToFullPath(fileId);
          if (!fullPath) continue;
          const mod = await reimportRouteModule(origin, changed, fileId);
          const nextComponent = normalizeRenderableComponent(mod?.Route?.options?.component);
          if (!nextComponent) {
            log('[NSRouter][hmr] re-import yielded no component for', fileId);
            continue;
          }
          // Patch the live router so future navigations use the fresh component.
          const route = findRouteByFullPath(router, fullPath);
          if (route?.options) route.options.component = nextComponent;
          // Remount any visible/backstack Page on that route in place.
          let remounted = 0;
          for (const page of collectFramePages(frame)) {
            if (page?.__nsRouterPath === fullPath && remountPage(page, nextComponent, log)) remounted++;
          }
          log('[NSRouter][hmr] route updated', fullPath, 'remounted=', remounted);
        } catch (err) {
          log('[NSRouter][hmr] route remount failed for', fileId, err);
        }
      }
    } catch (err) {
      log('[NSRouter][hmr] update handler failed', err);
    } finally {
      running = false;
    }
  };

  const prev = g.__NS_HMR_ON_UPDATE__;
  const hook = (payload: NsHmrUpdatePayload) => {
    try {
      if (typeof prev === 'function') prev(payload);
    } catch {}
    void onUpdate(payload);
  };
  g.__NS_HMR_ON_UPDATE__ = hook;
  log('[NSRouter][hmr] react HMR remount subscribed');

  return () => {
    if (g.__NS_HMR_ON_UPDATE__ === hook) g.__NS_HMR_ON_UPDATE__ = prev;
  };
}
