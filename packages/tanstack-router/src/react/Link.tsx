import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useMatchRoute } from '@tanstack/react-router';
import { resolveLinkTapAction, type LinkTapResult } from '../link-action';
import { MODAL_SEARCH_PARAM_KEY, withSingleModalPath } from '../modal-state';
import { closeModalFromRouterContext } from '../modal-controller';

// Loosely typed on purpose. TanStack's fully-generic `LinkOptions`/`RoutePaths`
// constraints depend on a single resolved `@tanstack/router-core` instance; in a
// dual-flavor (solid + react) package the type graphs collide, and the strong
// link typing buys little for a native tap-driven control. Navigation calls cast
// to `any` against the runtime router anyway.
export interface LinkProps {
  to?: string;
  params?: Record<string, any>;
  search?: Record<string, any> | ((prev: unknown) => unknown);
  hash?: string;
  replace?: boolean;
  state?: true | object | ((prev: unknown) => unknown);
  back?: boolean;
  closeModal?: boolean;
  modalTo?: string;
  fallbackTo?: string;
  onTap?: () => LinkTapResult;
  children?: ReactNode;
  class?: string;
  activeClass?: string;
  inactiveClass?: string;
  style?: string | Record<string, any>;
  [key: string]: any;
}

type AnyLinkProps = LinkProps;

function resolveNextState(prev: unknown, stateInput: AnyLinkProps['state']): unknown {
  if (stateInput === undefined || stateInput === true) {
    return prev;
  }

  const next = typeof stateInput === 'function' ? (stateInput as (previous: unknown) => unknown)(prev) : stateInput;

  if (!next || typeof next !== 'object') {
    return next;
  }

  if (!prev || typeof prev !== 'object') {
    return next;
  }

  return {
    ...(prev as Record<string, unknown>),
    ...(next as Record<string, unknown>),
  };
}

function resolveNavigateState(stateInput: AnyLinkProps['state']): true | ((prev: any) => any) | undefined {
  if (stateInput === undefined) {
    return undefined;
  }

  if (stateInput === true) {
    return true;
  }

  return (prev: any) => resolveNextState(prev, stateInput);
}

/**
 * Native `<Link>`: renders a tap-driven `<contentview>` that navigates the shared
 * NativeScript router. Mirrors the Solid Link, but as a plain React component —
 * the reconciler creates the `contentview` host node and wires `onTap` → the
 * native `tap` gesture via the renderer's prop translation.
 */
export function Link(props: LinkProps) {
  const router = useRouter() as any;
  const matchRoute = useMatchRoute() as any;

  const isActive = props.to
    ? !!matchRoute({
        to: props.to as any,
        params: props.params as any,
        fuzzy: false,
      })
    : false;

  const handleTap = () => {
    const action = resolveLinkTapAction({
      onTapResult: props.onTap?.(),
      back: props.back,
      closeModal: props.closeModal,
      canGoBack: router.history.canGoBack(),
      fallbackTo: props.fallbackTo,
      to: props.to,
    });

    if (action.type === 'none') {
      return;
    }

    if (action.type === 'back') {
      router.history.back();
      return;
    }

    if (action.type === 'close_modal') {
      if (closeModalFromRouterContext(router)) {
        return;
      }

      router.navigate({
        to: '.',
        search: (prev: unknown) => withSingleModalPath(prev, null),
        replace: props.replace ?? true,
      } as any);
      return;
    }

    if (props.modalTo) {
      const modalTo = props.modalTo;
      router.navigate({
        to: (props.to || '.') as any,
        params: props.params as any,
        state: resolveNavigateState(props.state),
        hash: props.hash as any,
        replace: props.replace,
        search: (prev: unknown) => {
          const base =
            typeof props.search === 'function'
              ? (props.search as (old: unknown) => unknown)(prev)
              : ({
                  ...(prev as Record<string, unknown>),
                  ...(props.search as Record<string, unknown> | undefined),
                } as unknown);

          return withSingleModalPath(base, modalTo, MODAL_SEARCH_PARAM_KEY);
        },
      } as any);
      return;
    }

    if (typeof action.to !== 'string') {
      return;
    }

    router.navigate({
      to: action.to,
      params: props.params as any,
      state: resolveNavigateState(props.state),
      search: props.search as any,
      hash: props.hash as any,
      replace: props.replace,
    });
  };

  const base = props.class || '';
  const active = isActive ? props.activeClass || '' : props.inactiveClass || '';
  const className = [base, active].filter(Boolean).join(' ');

  return createElement(
    'contentview',
    {
      class: className || undefined,
      style: props.style,
      onTap: handleTap,
    },
    props.children,
  );
}
