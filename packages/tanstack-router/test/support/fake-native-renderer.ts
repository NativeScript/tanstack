import { createRenderer } from '@solidjs/universal';
import { Errored, For, Loading, Match, Repeat, Reveal, Show, Switch } from 'solid-js';

type Listener = (args?: any) => void;

/**
 * Minimal stand-in for a DOMiNATIVE element: enough DOM-ish surface for the
 * universal renderer and PageRenderer, plus NativeScript Page's
 * `actionBar` / `content` slots.
 */
export class FakeNode {
  children: FakeNode[] = [];
  parent?: FakeNode;
  attrs: Record<string, unknown> = {};
  text?: string;
  actionBar?: FakeNode | null;
  content?: FakeNode | null;
  private listeners = new Map<string, Listener[]>();

  constructor(public tag: string) {}

  get firstChild(): FakeNode | undefined {
    return this.children[0];
  }

  get nextSibling(): FakeNode | undefined {
    if (!this.parent) return undefined;
    return this.parent.children[this.parent.children.indexOf(this) + 1];
  }

  insertBefore(node: FakeNode, anchor?: FakeNode | null) {
    node.parent?.removeChild(node);
    const idx = anchor ? this.children.indexOf(anchor) : -1;
    if (idx >= 0) this.children.splice(idx, 0, node);
    else this.children.push(node);
    node.parent = this;
    if (this.tag === 'page' && node.tag !== '#text') {
      if (node.tag === 'actionbar') this.actionBar = node;
      else this.content = node;
    }
  }

  removeChild(node: FakeNode) {
    const idx = this.children.indexOf(node);
    if (idx >= 0) this.children.splice(idx, 1);
    node.parent = undefined;
  }

  setAttribute(name: string, value: unknown) {
    this.attrs[name] = value;
  }

  removeAttribute(name: string) {
    delete this.attrs[name];
  }

  on(event: string, fn: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]);
  }

  addEventListener(event: string, fn: Listener) {
    this.on(event, fn);
  }

  removeEventListener(event: string, fn: Listener) {
    this.listeners.set(
      event,
      (this.listeners.get(event) ?? []).filter((l) => l !== fn),
    );
  }

  emit(event: string, args?: any) {
    for (const fn of this.listeners.get(event) ?? []) fn(args);
  }
}

export function collectTags(node: FakeNode, out: string[] = []): string[] {
  for (const child of node.children) {
    if (child.tag !== '#text') out.push(child.tag);
    collectTags(child, out);
  }
  return out;
}

export function createFakeNativeRenderer() {
  return createRenderer<FakeNode>({
    createElement: (tag) => new FakeNode(tag),
    createTextNode(value) {
      const node = new FakeNode('#text');
      node.text = value;
      return node;
    },
    isTextNode: (node) => node.tag === '#text',
    replaceText(node, value) {
      node.text = value;
    },
    setProperty(node, name, value) {
      node.attrs[name] = value;
    },
    insertNode: (parent, node, anchor) => parent.insertBefore(node, anchor),
    removeNode: (parent, node) => parent.removeChild(node),
    getParentNode: (node) => node.parent as FakeNode,
    getFirstChild: (node) => node.firstChild as FakeNode,
    getNextSibling: (node) => node.nextSibling as FakeNode,
  });
}

/** Module shape of `@nativescript-community/solid-js`, backed by FakeNode. */
export function createFakeCommunitySolid() {
  const renderer = createFakeNativeRenderer();
  return {
    ...renderer,
    For,
    Repeat,
    Show,
    Switch,
    Match,
    Loading,
    Reveal,
    Errored,
  };
}
