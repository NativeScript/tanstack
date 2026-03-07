import { describe, expect, it, vi } from 'vitest';
import { closeModalFromRouterContext } from '../src/modal-controller';

describe('modal-controller helper', () => {
  it('returns false when no controller exists', () => {
    expect(closeModalFromRouterContext({})).toBe(false);
  });

  it('closes modal through controller and returns true', () => {
    const close = vi.fn();
    const router = {
      options: {
        context: {
          __nsModalController: {
            close,
          },
        },
      },
    };

    expect(closeModalFromRouterContext(router)).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
