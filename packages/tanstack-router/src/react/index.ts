// React entrypoint for @nativescript/tanstack-router

// === NativeScript-specific exports ===
export { createNativeScriptHistory } from '../history';
export { createNativeScriptRouter } from './router';
export { NativeScriptRouterProvider } from './NativeScriptRouterProvider';
export type { NativeScriptRouterProviderProps, NativeScriptPageActionBarContext } from './NativeScriptRouterProvider';
export { Link } from './Link';
export type { Register, RegisteredRouter } from '../register';
export { createNativeScriptNavigationState, createNativeScriptTransitionState } from '../transition-state';
export { MODAL_SEARCH_PARAM_KEY, withSingleModalPath } from '../modal-state';
export type { NativeScriptNavigationOptions, NativeScriptNavigationState, NativeScriptNavigationTransition, NativeScriptModalDetent, NativeScriptModalIOSPresentationOptions, NativeScriptModalPresentationOptions, NativeScriptModalOptionsResolver, NativeScriptModalOptionsResolverContext } from '../types';

// === Re-exports from @tanstack/react-router ===
// Route definition
export { createRootRoute, createRootRouteWithContext, createRoute, createFileRoute, createLazyRoute, rootRouteId, RouteApi, getRouteApi } from '@tanstack/react-router';

// Router creation (for users who want full control over history)
export { createRouter } from '@tanstack/react-router';

// Hooks
export { useRouter, useRouterState, useNavigate, useMatch, useMatches, useParentMatches, useChildMatches, useParams, useSearch, useLoaderData, useLoaderDeps, useLocation, useRouteContext, useMatchRoute, useBlocker, useCanGoBack } from '@tanstack/react-router';

// Components (that work in NativeScript context)
export { Navigate, MatchRoute, Await } from '@tanstack/react-router';
