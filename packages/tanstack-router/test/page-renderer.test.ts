import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderSpy = vi.fn<(fn: () => unknown, target: unknown) => () => void>();

vi.mock('@nativescript-community/solid-js', () => ({
  render: (...args: unknown[]) => renderSpy(...(args as [() => unknown, unknown])),
}));

vi.mock('@tanstack/solid-router', () => ({
  RouterContextProvider: (props: { children?: unknown }) => (typeof props.children === 'function' ? (props.children as () => unknown)() : props.children),
}));

import { renderPage } from '../src/PageRenderer';

class FakePage {
  private handlers = new Map<string, Array<(args?: any) => void>>();
  public __nsRouterPath?: string;

  on(eventName: string, handler: (args?: any) => void) {
    const eventHandlers = this.handlers.get(eventName) ?? [];
    eventHandlers.push(handler);
    this.handlers.set(eventName, eventHandlers);
  }

  emit(eventName: string, args?: any) {
    for (const handler of this.handlers.get(eventName) ?? []) {
      handler(args);
    }
  }
}

describe('renderPage', () => {
  beforeEach(() => {
    renderSpy.mockReset();
    vi.useFakeTimers();

    (globalThis as any).document = {
      createElement: vi.fn(() => new FakePage()),
    };
  });

  it('re-mounts on navigatedTo even when router path is stale/pending after native back', () => {
    const disposeSpy = vi.fn();
    renderSpy.mockReturnValue(disposeSpy);

    const onNativeBack = vi.fn();
    const onVisiblePathChange = vi.fn();

    const router = {
      state: {
        status: 'pending',
        location: {
          pathname: '/posts/1',
        },
      },
    } as any;

    const page = renderPage(router, (() => null) as any, '/', onNativeBack, onVisiblePathChange, true) as FakePage;

    expect(renderSpy).toHaveBeenCalledTimes(1);

    page.emit('navigatingFrom', { isBackNavigation: true });
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    vi.runAllTimers();
    expect(onNativeBack).toHaveBeenCalledWith('/');

    // Router path is still stale ("/posts/1") while the visible native page is "/".
    // navigatedTo must still re-mount deterministically.
    page.emit('navigatedTo');

    expect(onVisiblePathChange).toHaveBeenCalledWith('/');
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });
});
