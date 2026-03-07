export const MODAL_SEARCH_PARAM_KEY = '@modal';

export function getSingleModalPathFromSearch(search: unknown, modalKey = MODAL_SEARCH_PARAM_KEY): string | null {
  if (!search || typeof search !== 'object') {
    return null;
  }

  const raw = (search as Record<string, unknown>)[modalKey];

  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'false') {
    return null;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function withSingleModalPath(search: unknown, modalPath: string | null, modalKey = MODAL_SEARCH_PARAM_KEY): Record<string, unknown> {
  const next: Record<string, unknown> = search && typeof search === 'object' ? { ...(search as Record<string, unknown>) } : {};

  if (!modalPath) {
    delete next[modalKey];
    return next;
  }

  const normalized = modalPath.startsWith('/') ? modalPath : `/${modalPath}`;
  next[modalKey] = normalized;
  return next;
}
