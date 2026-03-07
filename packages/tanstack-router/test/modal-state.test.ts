import { describe, expect, it } from 'vitest';
import { getSingleModalPathFromSearch, MODAL_SEARCH_PARAM_KEY, withSingleModalPath } from '../src/modal-state';

describe('modal-state helpers', () => {
  describe('getSingleModalPathFromSearch', () => {
    it('returns null when missing', () => {
      expect(getSingleModalPathFromSearch(undefined)).toBeNull();
      expect(getSingleModalPathFromSearch({})).toBeNull();
    });

    it('normalizes a relative modal path', () => {
      expect(getSingleModalPathFromSearch({ [MODAL_SEARCH_PARAM_KEY]: 'users/123' })).toBe('/users/123');
    });

    it('returns null for disabled modal marker', () => {
      expect(getSingleModalPathFromSearch({ [MODAL_SEARCH_PARAM_KEY]: 'false' })).toBeNull();
    });
  });

  describe('withSingleModalPath', () => {
    it('sets modal query path while preserving other search keys', () => {
      expect(withSingleModalPath({ page: 2 }, '/users/123')).toEqual({
        page: 2,
        [MODAL_SEARCH_PARAM_KEY]: '/users/123',
      });
    });

    it('removes modal query key when clearing', () => {
      expect(withSingleModalPath({ page: 2, [MODAL_SEARCH_PARAM_KEY]: '/users/123' }, null)).toEqual({
        page: 2,
      });
    });
  });
});
