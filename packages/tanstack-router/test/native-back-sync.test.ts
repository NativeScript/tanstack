import { describe, expect, it } from 'vitest';
import { getNativeBackCallbackDecision, getNativeBackTimeoutReconcilePath, resetNativeBackSyncScheduled, shouldCompleteNativeBackSyncOnVisiblePath, shouldScheduleNativeBackSync } from '../src/native-back-sync';

describe('native-back-sync helpers', () => {
  describe('getNativeBackCallbackDecision', () => {
    it('returns run when guard is inactive and history can go back', () => {
      expect(
        getNativeBackCallbackDecision({
          guardActive: false,
          canGoBack: true,
        }),
      ).toBe('run');
    });

    it('returns guard ignore when navigation guard is active', () => {
      expect(
        getNativeBackCallbackDecision({
          guardActive: true,
          canGoBack: true,
        }),
      ).toBe('ignore_guard_active');
    });

    it('returns cannot-go-back ignore when history cannot go back', () => {
      expect(
        getNativeBackCallbackDecision({
          guardActive: false,
          canGoBack: false,
        }),
      ).toBe('ignore_cannot_go_back');
    });
  });

  describe('shouldScheduleNativeBackSync', () => {
    it('schedules exactly once for a back-pop transition', () => {
      expect(
        shouldScheduleNativeBackSync({
          isBackNavigation: true,
          alreadyScheduled: false,
        }),
      ).toBe(true);

      expect(
        shouldScheduleNativeBackSync({
          isBackNavigation: true,
          alreadyScheduled: true,
        }),
      ).toBe(false);
    });

    it('does not schedule for forward navigation', () => {
      expect(
        shouldScheduleNativeBackSync({
          isBackNavigation: false,
          alreadyScheduled: false,
        }),
      ).toBe(false);
    });
  });

  describe('resetNativeBackSyncScheduled', () => {
    it('resets scheduling state to false', () => {
      expect(resetNativeBackSyncScheduled()).toBe(false);
    });
  });

  describe('getNativeBackTimeoutReconcilePath', () => {
    it('returns visible path when router path is stale after timeout', () => {
      expect(
        getNativeBackTimeoutReconcilePath({
          visiblePath: '/',
          activePath: '/posts/1',
        }),
      ).toBe('/');
    });

    it('returns null when visible path matches active path', () => {
      expect(
        getNativeBackTimeoutReconcilePath({
          visiblePath: '/posts/1',
          activePath: '/posts/1',
        }),
      ).toBeNull();
    });

    it('returns null for empty or missing visible path', () => {
      expect(
        getNativeBackTimeoutReconcilePath({
          visiblePath: '   ',
          activePath: '/posts/1',
        }),
      ).toBeNull();

      expect(
        getNativeBackTimeoutReconcilePath({
          visiblePath: undefined,
          activePath: '/posts/1',
        }),
      ).toBeNull();
    });
  });

  describe('shouldCompleteNativeBackSyncOnVisiblePath', () => {
    it('completes in-flight sync when visible and active paths align', () => {
      expect(
        shouldCompleteNativeBackSyncOnVisiblePath({
          inFlight: true,
          visiblePath: '/',
          activePath: '/',
        }),
      ).toBe(true);
    });

    it('does not complete when sync is not in flight', () => {
      expect(
        shouldCompleteNativeBackSyncOnVisiblePath({
          inFlight: false,
          visiblePath: '/',
          activePath: '/',
        }),
      ).toBe(false);
    });

    it('does not complete when paths are still mismatched', () => {
      expect(
        shouldCompleteNativeBackSyncOnVisiblePath({
          inFlight: true,
          visiblePath: '/',
          activePath: '/posts/1',
        }),
      ).toBe(false);
    });
  });
});
