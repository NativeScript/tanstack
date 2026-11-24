import { flush, runWithOwner } from 'solid-js';
import type { AnyRouter } from '@tanstack/solid-router';

/**
 * Stand-in for the transition hook solid-router's `<Transitioner />` installs.
 * NativeScript renders Pages through Frame.navigate() instead of a `<Matches>`
 * tree, so `<Transitioner />` is never mounted. router-core still moves `status`
 * to idle, sets `resolvedLocation` and emits onResolved/onRendered once the
 * returned promise settles.
 */
export function installNativeScriptStartTransition(router: AnyRouter): void {
  router.startTransition = (fn: () => void) => {
    // Store writes are forbidden inside owned scopes; flushing right away lets
    // listeners see the committed matches before the router reports them rendered.
    runWithOwner(null, fn);
    try {
      flush();
    } catch {
      // As in <Transitioner />: an effect error must not abort the router's commit.
    }
    return Promise.resolve(true);
  };
}
