import { createMemo, type Accessor } from 'solid-js';

interface StableLoaderDataOptions<T> {
  fallback?: T;
}

export function useStableLoaderData<T>(loaderData: Accessor<T | undefined>, options: { fallback: T }): Accessor<T>;
export function useStableLoaderData<T>(loaderData: Accessor<T | undefined>, options?: StableLoaderDataOptions<T>): Accessor<T | undefined>;

// Keeps the latest resolved loader snapshot to avoid transient undefined
// values during route/backstack synchronization.
export function useStableLoaderData<T>(loaderData: Accessor<T | undefined>, options?: StableLoaderDataOptions<T>): Accessor<T | undefined> {
  let lastResolved = loaderData() ?? options?.fallback;

  return createMemo(() => {
    const current = loaderData();
    if (current !== undefined) {
      lastResolved = current;
    }

    return lastResolved;
  }) as Accessor<T | undefined>;
}
