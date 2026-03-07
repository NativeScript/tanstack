export interface NavigationGuard {
  isNavigating: boolean;
  lockReason?: string;
  lockTimeoutId?: ReturnType<typeof setTimeout>;
}

export interface NativeScriptNavigationTransition {
  name?: string;
  duration?: number;
  curve?: any;
  instance?: any;
}

export interface NativeScriptNavigationOptions {
  transition?: NativeScriptNavigationTransition;
}

export interface NativeScriptNavigationState {
  __nsNavigation?: NativeScriptNavigationOptions;
}

export type NativeScriptModalDetent = 'medium' | 'large';

export interface NativeScriptModalIOSPresentationOptions {
  presentationStyle?: number;
  detents?: NativeScriptModalDetent[];
  selectedDetent?: NativeScriptModalDetent;
  prefersGrabberVisible?: boolean;
  prefersScrollingExpandsWhenScrolledToEdge?: boolean;
  prefersEdgeAttachedInCompactHeight?: boolean;
  preferredCornerRadius?: number;
  transparentBackgroundOnIOS26?: boolean;
}

export interface NativeScriptModalPresentationOptions {
  animated?: boolean;
  fullscreen?: boolean;
  ios?: NativeScriptModalIOSPresentationOptions;
}

export interface NativeScriptModalOptionsResolverContext {
  modalPath: string;
  routeId: string;
}

export type NativeScriptModalOptionsResolver = (context: NativeScriptModalOptionsResolverContext) => NativeScriptModalPresentationOptions | undefined;
