import type { NativeScriptNavigationOptions, NativeScriptNavigationState, NativeScriptNavigationTransition } from './types';

export function createNativeScriptNavigationState(options: NativeScriptNavigationOptions): NativeScriptNavigationState {
  return {
    __nsNavigation: options,
  };
}

export function createNativeScriptTransitionState(transition: NativeScriptNavigationTransition): NativeScriptNavigationState {
  return createNativeScriptNavigationState({ transition });
}
