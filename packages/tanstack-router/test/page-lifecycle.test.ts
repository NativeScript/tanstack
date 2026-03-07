import { describe, expect, it } from 'vitest';
import { shouldUnmountPageOnNavigatingFrom } from '../src/page-lifecycle';

describe('page-lifecycle helpers', () => {
  it('unmounts when page is popped due to back navigation', () => {
    expect(shouldUnmountPageOnNavigatingFrom({ isBackNavigation: true })).toBe(true);
  });

  it('keeps page mounted when page moves to backstack on forward navigation', () => {
    expect(shouldUnmountPageOnNavigatingFrom({ isBackNavigation: false })).toBe(false);
  });

  it('keeps page mounted when args are missing', () => {
    expect(shouldUnmountPageOnNavigatingFrom(undefined)).toBe(false);
  });
});
