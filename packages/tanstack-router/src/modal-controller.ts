export function closeModalFromRouterContext(router: unknown): boolean {
  const closeFn = (router as any)?.options?.context?.__nsModalController?.close;

  if (typeof closeFn !== 'function') {
    return false;
  }

  closeFn();
  return true;
}
