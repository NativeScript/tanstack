import { describe, expect, it } from 'vitest';
import { describeComponentShape, normalizeRenderableComponent } from '../src/component-shape';

describe('component-shape helpers', () => {
  it('normalizes direct function components', () => {
    const Comp = () => null;
    expect(normalizeRenderableComponent(Comp)).toBe(Comp);
  });

  it('normalizes nested default wrappers from interop layers', () => {
    const Comp = () => null;
    const wrapped = { default: { default: Comp } };
    expect(normalizeRenderableComponent(wrapped)).toBe(Comp);
  });

  it('returns null for non-component values', () => {
    expect(normalizeRenderableComponent(undefined)).toBeNull();
    expect(normalizeRenderableComponent({ default: { notAComponent: true } })).toBeNull();
    expect(normalizeRenderableComponent('label')).toBeNull();
  });

  it('describes function and object shapes for diagnostics', () => {
    function NamedComp() {
      return null;
    }
    expect(describeComponentShape(NamedComp)).toBe('function:NamedComp');
    expect(describeComponentShape({ default: NamedComp, extra: true })).toContain('object keys=[');
    expect(describeComponentShape(null)).toBe('object');
  });
});
