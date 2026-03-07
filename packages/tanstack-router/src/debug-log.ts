export function createDebugLogger(enabled: boolean | undefined) {
  return (...args: unknown[]) => {
    if (enabled) {
      console.log(...args);
    }
  };
}
