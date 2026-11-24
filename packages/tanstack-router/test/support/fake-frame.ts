import { FakeNode } from './fake-native-renderer';

interface FakeNavigationEntry {
  create: () => FakeNode;
  animated?: boolean;
  backstackVisible?: boolean;
}

interface FakeBackstackEntry {
  entry: FakeNavigationEntry;
  resolvedPage: FakePage;
}

/** Every modal currently presented by any FakePage, in presentation order. */
export const presentedModals: FakePage[] = [];

/**
 * Page with NativeScript's modal surface. Android dismisses dialogs
 * asynchronously, so the close callback fires on a later macrotask.
 */
export class FakePage extends FakeNode {
  isLoaded = true;
  modalHost?: FakePage;
  showModalCalls = 0;
  private closeCallback?: () => void;

  showModal(modalPage: FakePage, options: { closeCallback?: () => void }) {
    this.showModalCalls += 1;
    modalPage.modalHost = this;
    modalPage.closeCallback = options?.closeCallback;
    presentedModals.push(modalPage);
  }

  closeModal() {
    const idx = presentedModals.indexOf(this);
    if (idx < 0) return;
    presentedModals.splice(idx, 1);
    this.modalHost = undefined;
    const cb = this.closeCallback;
    this.closeCallback = undefined;
    setTimeout(() => cb?.(), 0);
  }
}

/**
 * Frame with NativeScript's backstack rule: when navigating away, the outgoing
 * entry is kept only if *its own* `backstackVisible` is not false.
 */
export class FakeFrame extends FakeNode {
  currentPage?: FakePage;
  private currentEntry?: FakeBackstackEntry;
  backStack: FakeBackstackEntry[] = [];
  navigations: Array<{ animated?: boolean; backstackVisible?: boolean }> = [];

  navigate(entry: FakeNavigationEntry) {
    this.navigations.push({ animated: entry.animated, backstackVisible: entry.backstackVisible });
    const page = entry.create() as FakePage;
    const outgoing = this.currentEntry;
    if (outgoing) {
      outgoing.resolvedPage.emit('navigatingFrom', { isBackNavigation: false });
      if (outgoing.entry.backstackVisible !== false) this.backStack.push(outgoing);
    }
    this.currentEntry = { entry, resolvedPage: page };
    this.currentPage = page;
    page.emit('navigatedTo', { isBackNavigation: false });
  }

  canGoBack() {
    return this.backStack.length > 0;
  }

  goBack(to?: FakeBackstackEntry) {
    const idx = to ? this.backStack.indexOf(to) : this.backStack.length - 1;
    if (idx < 0) return;
    const target = this.backStack[idx];
    this.backStack.length = idx;
    this.currentPage?.emit('navigatingFrom', { isBackNavigation: true });
    this.currentEntry = target;
    this.currentPage = target.resolvedPage;
    target.resolvedPage.emit('navigatedTo', { isBackNavigation: true });
  }

  /** Pages from the bottom of the stack to the visible one. */
  pagePaths(): string[] {
    return [...this.backStack.map((e) => (e.resolvedPage as any).__nsRouterPath), (this.currentPage as any)?.__nsRouterPath];
  }
}

export function createFakeElementFactory() {
  return (tag: string) => {
    const t = tag.toLowerCase();
    if (t === 'frame') return new FakeFrame('frame');
    if (t === 'page') return new FakePage('page');
    return new FakeNode(t);
  };
}
