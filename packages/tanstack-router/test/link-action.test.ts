import { describe, expect, it } from 'vitest';
import { resolveLinkTapAction } from '../src/link-action';

describe('link-action resolver', () => {
  it('navigates to `to` by default', () => {
    expect(
      resolveLinkTapAction({
        canGoBack: true,
        to: '/posts',
      }),
    ).toEqual({ type: 'navigate', to: '/posts' });
  });

  it('uses back action when back mode is enabled and history is available', () => {
    expect(
      resolveLinkTapAction({
        back: true,
        canGoBack: true,
        to: '/posts',
      }),
    ).toEqual({ type: 'back' });
  });

  it('falls back to fallbackTo when back mode has no history', () => {
    expect(
      resolveLinkTapAction({
        back: true,
        canGoBack: false,
        fallbackTo: '/posts',
      }),
    ).toEqual({ type: 'navigate', to: '/posts' });
  });

  it('skips default action when onTap returns false', () => {
    expect(
      resolveLinkTapAction({
        onTapResult: false,
        canGoBack: true,
        to: '/posts',
      }),
    ).toEqual({ type: 'none' });
  });

  it('resolves close-modal action when closeModal is set', () => {
    expect(
      resolveLinkTapAction({
        closeModal: true,
        canGoBack: true,
      }),
    ).toEqual({ type: 'close_modal' });
  });
});
