// Shim for solid-js/web in NativeScript.
// Re-exports core solid-js plus web-specific symbols used by router internals.
export * from 'solid-js';

export const isServer = false;

export function Dynamic(props) {
  const comp = typeof props.component === 'function' ? props.component : null;
  if (comp) return comp(props);
  return null;
}

export function delegateEvents() {}
export function clearDelegatedEvents() {}
export function spread() {}
export function assign() {}
export function setAttribute() {}
export function setProperty() {}
export function insert() {}
export function effect() {}
export function style() {}
export function classList() {}
export function memo(fn) {
  return fn;
}
export function template() {
  return function () {};
}
export function getNextElement() {}
export function getNextMarker() {}
export function getNextMatch() {}
export function escape(s) {
  return s;
}
export function ssrElement() {
  return '';
}
export function ssrAttribute() {
  return '';
}
export function ssrHydrationKey() {
  return '';
}
export function ssr() {
  return '';
}
export function ssrSpread() {
  return '';
}
export function resolveSSRNode() {
  return '';
}
export function generateHydrationScript() {
  return '';
}
export function HydrationScript() {
  return '';
}
export function Hydration() {
  return '';
}
export function NoHydration() {
  return '';
}
export function getHydrationKey() {}
export function hydrate() {}
export function renderToString() {
  return '';
}
export function renderToStringAsync() {
  return Promise.resolve('');
}
export function renderToStream() {
  return {};
}
export function Assets() {
  return null;
}
export function useAssets() {}
export function pipeToNodeWritable() {}
export function pipeToWritable() {}
export function addEventListener() {}
export function removeEventListener() {}
export function dynamicProperty() {}
export function setAttributeNS() {}
export const Aliases = {};
export function getPropAlias(prop) {
  return prop;
}
export const Properties = new Set();
export const ChildProperties = new Set();
export const DelegatedEvents = new Set();
export const SVGElements = new Set();
export const SVGNamespace = {};
