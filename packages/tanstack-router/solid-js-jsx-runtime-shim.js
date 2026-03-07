// NativeScript-safe JSX runtime shim for packages that import solid-js/jsx-runtime.
// Keep this shim free of deep solid-js subpath imports because NativeScript
// webpack aliasing can redirect `solid-js` and break `solid-js/*` resolution.
import { createComponent } from 'solid-js';

export function Fragment(props) {
  return props?.children ?? null;
}

export function jsx(type, props) {
  if (typeof type === 'function') {
    return createComponent(type, props || {});
  }

  // For rare intrinsic tags in this package, return a minimal vnode-like shape.
  return { type, props: props || {} };
}

export const jsxs = jsx;
export const jsxDEV = jsx;
