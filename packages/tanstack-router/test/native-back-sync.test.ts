import { describe, expect, it } from 'vitest';
import { getNativeBackCallbackDecision, resetNativeBackSyncScheduled, shouldScheduleNativeBackSync } from '../src/native-back-sync';

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
});
