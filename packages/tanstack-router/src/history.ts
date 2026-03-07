import { createMemoryHistory, type RouterHistory } from '@tanstack/history';

export function createNativeScriptHistory(opts?: { initialPath?: string }): RouterHistory {
  return createMemoryHistory({
    initialEntries: [opts?.initialPath || '/'],
  });
}
