import { createNativeScriptTransitionState } from '@nativescript/tanstack-router/solid';
import { PageTransition, SharedTransition } from '@nativescript/core';

export function getPostAuthorAvatarTag(authorId: string): string {
  return `post-author-avatar-${authorId}`;
}

export function createPostAuthorSharedTransitionState(authorId: string) {
  return createNativeScriptTransitionState(
    SharedTransition.custom(new PageTransition(), {
      pageEnd: {
        // use nice linear duration on Android
        duration: __ANDROID__ ? 800 : null,
        // use custom spring on iOS
        spring: { tension: 60, friction: 8, mass: 1 },
      },
    }),
  );
}
