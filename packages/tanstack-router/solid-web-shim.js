// NativeScript stand-in for `@solidjs/web`, aliased by nativescript.vite.mjs and
// nativescript.webpack.js. @tanstack/solid-router's compiled output takes its
// renderer helpers from `@solidjs/web`; binding them to the universal renderer of
// @nativescript-community/solid-js keeps router internals and app JSX on one
// renderer. Everything here must import `solid-js` (never `@solidjs/web`) so the
// alias cannot loop back onto this file.
import { createComponent, omit } from 'solid-js';
import { dynamicCore } from 'solid-js/internal';
import { createElement, spread } from '@nativescript-community/solid-js';

// Same surface @solidjs/web re-exports from core.
export { Errored, For, Hydration, Loading, Match, NoHydration, Repeat, Reveal, Show, Switch, createComponent, dynamicComponent, getOwner, merge as mergeProps, untrack } from 'solid-js';
export { render, insert, spread, effect, memo, ref, applyRef } from '@nativescript-community/solid-js';

export const isServer = false;

// Must equal @solidjs/web's value: the router compares it against server-function
// response headers.
export const REVALIDATE_HEADER = 'X-Revalidate';

function createNativeElement(tag, props) {
  const node = createElement(tag);
  spread(node, props);
  return node;
}

export function dynamic(source, options) {
  return dynamicCore(source, options, createNativeElement);
}

export function Dynamic(props) {
  return createComponent(
    dynamic(() => props.component),
    omit(props, 'component'),
  );
}

export function setAttribute(node, name, value) {
  if (value == null) {
    node.removeAttribute?.(name);
  } else {
    node.setAttribute(name, value);
  }
}

// HTML templates only back the router's DOM defaults (ErrorComponent,
// DefaultGlobalNotFound, Asset, ScriptOnce, its web <Link>). There is no HTML
// parser in NativeScript, so instantiating one fails loudly instead of handing
// `insert()` an undefined parent.
export function template(html) {
  const tag = /^<([\w-]+)/.exec(html)?.[1] ?? 'unknown';
  return () => {
    throw new Error(`[@nativescript/tanstack-router] The router's built-in <${tag}> DOM fallback cannot render in NativeScript. ` + "Provide NativeScript components through defaultErrorComponent / defaultNotFoundComponent (or a route's errorComponent / notFoundComponent).");
  };
}

// Event delegation is a DOM concept; dominative dispatches events per node.
export function delegateEvents() {}

// There is no document <head> and no SSR hydration payload in NativeScript.
export function useHead() {}
export function HydrationScript() {
  return null;
}
export function getHydrationWriter() {
  return undefined;
}
export function takeHydrationValue() {
  return undefined;
}
