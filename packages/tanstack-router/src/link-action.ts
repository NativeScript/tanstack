export type LinkTapResult = void | boolean;

export interface ResolveLinkTapActionOptions<TTo extends string | {} = string> {
  onTapResult?: LinkTapResult;
  back?: boolean;
  closeModal?: boolean;
  canGoBack: boolean;
  fallbackTo?: TTo;
  to?: TTo;
}

export type LinkTapAction<TTo extends string | {} = string> = { type: 'none' } | { type: 'back' } | { type: 'close_modal' } | { type: 'navigate'; to: TTo };

export function resolveLinkTapAction<TTo extends string | {} = string>(opts: ResolveLinkTapActionOptions<TTo>): LinkTapAction<TTo> {
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
