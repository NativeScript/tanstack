import type { RegisteredRouter as CoreRegisteredRouter } from '@tanstack/router-core';

// Module augmentation target for consumers:
// declare module '@nativescript/tanstack-router/solid' { interface Register { router: typeof router } }
export interface Register {}

export type RegisteredRouter = CoreRegisteredRouter<Register>;
