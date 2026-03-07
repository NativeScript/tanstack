export type LinkTapResult = void | boolean;

export interface ResolveLinkTapActionOptions {
  onTapResult?: LinkTapResult;
  back?: boolean;
  closeModal?: boolean;
  canGoBack: boolean;
  fallbackTo?: string;
  to?: string;
}

export type LinkTapAction = { type: 'none' } | { type: 'back' } | { type: 'close_modal' } | { type: 'navigate'; to: string };

export function resolveLinkTapAction(opts: ResolveLinkTapActionOptions): LinkTapAction {
  if (opts.onTapResult === false) {
    return { type: 'none' };
  }

  if (opts.back) {
    if (opts.canGoBack) {
      return { type: 'back' };
    }

    if (opts.fallbackTo) {
      return { type: 'navigate', to: opts.fallbackTo };
    }

    if (opts.to) {
      return { type: 'navigate', to: opts.to };
    }

    return { type: 'none' };
  }

  if (opts.closeModal) {
    return { type: 'close_modal' };
  }

  if (opts.to) {
    return { type: 'navigate', to: opts.to };
  }

  return { type: 'none' };
}
