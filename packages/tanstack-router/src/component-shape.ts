export type RenderableComponent = (props?: any) => any;

export function normalizeRenderableComponent(value: unknown): RenderableComponent | null {
  let current: unknown = value;

  // Handle common transpilation/interop wrappers like { default: Comp }
  // and nested variants such as { default: { default: Comp } }.
  for (let i = 0; i < 4; i++) {
    if (typeof current === 'function') {
      return current as RenderableComponent;
    }

    if (current && typeof current === 'object' && 'default' in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>).default;
      continue;
    }

    return null;
  }

  return typeof current === 'function' ? (current as RenderableComponent) : null;
}

export function describeComponentShape(value: unknown): string {
  if (typeof value === 'function') {
    return `function:${(value as any).name || 'anonymous'}`;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).slice(0, 10);
    return `object keys=[${keys.join(', ')}]`;
  }

  return `${typeof value}`;
}
