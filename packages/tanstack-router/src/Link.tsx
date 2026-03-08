import { createMemo, createRenderEffect, onCleanup, type JSX } from 'solid-js'
import { createElement, insert, setProp } from '@nativescript-community/solid-js'
import type { AnyRouter, LinkOptions, RoutePaths } from '@tanstack/solid-router'
import { useRouter, useMatchRoute } from '@tanstack/solid-router'
import type { RegisteredRouter } from './register'
import { resolveLinkTapAction, type LinkTapResult } from './link-action'
import { MODAL_SEARCH_PARAM_KEY, withSingleModalPath } from './modal-state'
import { closeModalFromRouterContext } from './modal-controller'

type LinkProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends RoutePaths<TRouter['routeTree']> | string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends RoutePaths<TRouter['routeTree']> | string = TFrom,
  TMaskTo extends string = '.',
> = Omit<LinkOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>, 'to' | 'state'> & {
  to?: LinkOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>['to']
  state?: true | object | ((prev: unknown) => unknown)
  back?: boolean
  closeModal?: boolean
  modalTo?: string
  fallbackTo?: LinkOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>['to']
  onTap?: () => LinkTapResult
  children: JSX.Element
  class?: string
  activeClass?: string
  inactiveClass?: string
  style?: string
}

type AnyLinkProps = LinkProps<AnyRouter, string, string | undefined, string, string>

function resolveNextState(
  prev: unknown,
  stateInput: AnyLinkProps['state'],
): unknown {
  if (stateInput === undefined || stateInput === true) {
    return prev
  }

  const next =
    typeof stateInput === 'function'
      ? (stateInput as (previous: unknown) => unknown)(prev)
      : stateInput

  if (!next || typeof next !== 'object') {
    return next
  }

  if (!prev || typeof prev !== 'object') {
    return next
  }

  return {
    ...(prev as Record<string, unknown>),
    ...(next as Record<string, unknown>),
  }
}

function resolveNavigateState(stateInput: AnyLinkProps['state']): true | ((prev: any) => any) | undefined {
  if (stateInput === undefined) {
    return undefined
  }

  if (stateInput === true) {
    return true
  }

  return (prev: any) => resolveNextState(prev, stateInput)
}

export function Link<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends RoutePaths<TRouter['routeTree']> | string = string,
  const TTo extends string | undefined = '.',
  const TMaskFrom extends RoutePaths<TRouter['routeTree']> | string = TFrom,
  const TMaskTo extends string = '.',
>(props: LinkProps<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>) {
  const router = useRouter()
  const matchRoute = useMatchRoute()

  const isActive = createMemo(() => {
    if (!props.to) {
      return false
    }

    return !!matchRoute({
      to: props.to as any,
      params: props.params as any,
      fuzzy: false,
    })()
  })

  const handleTap = () => {
    const action = resolveLinkTapAction({
      onTapResult: props.onTap?.(),
      back: props.back,
      closeModal: props.closeModal,
      canGoBack: router.history.canGoBack(),
      fallbackTo: props.fallbackTo,
      to: props.to,
    })

    if (action.type === 'none') {
      return
    }

    if (action.type === 'back') {
      router.history.back()
      return
    }

    if (action.type === 'close_modal') {
      if (closeModalFromRouterContext(router)) {
        return
      }

      router.navigate({
        to: '.',
        search: (prev: unknown) => withSingleModalPath(prev, null),
        replace: props.replace ?? true,
      } as any)
      return
    }

    if (props.modalTo) {
      const modalTo = props.modalTo
      router.navigate({
        to: (props.to || '.') as TTo,
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
                } as unknown)

          return withSingleModalPath(base, modalTo, MODAL_SEARCH_PARAM_KEY)
        },
      } as any)
      return
    }

    if (typeof action.to !== 'string') {
      return
    }

    router.navigate({
      to: action.to,
      params: props.params as any,
      state: resolveNavigateState(props.state),
      search: props.search as any,
      hash: props.hash as any,
      replace: props.replace,
    })
  }

  const currentClass = () => {
    const base = props.class || ''
    const active = isActive() ? (props.activeClass || '') : (props.inactiveClass || '')
    return [base, active].filter(Boolean).join(' ')
  }

  const contentView = createElement('contentview') as any
  contentView.addEventListener('tap', handleTap)

  onCleanup(() => {
    contentView.removeEventListener('tap', handleTap)
  })

  createRenderEffect(() => {
    setProp(contentView, 'class', currentClass())
    setProp(contentView, 'style', props.style)
  })

  insert(contentView, props.children as any)

  return contentView
}
