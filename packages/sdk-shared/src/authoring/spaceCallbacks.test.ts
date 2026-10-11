import { describe, expect, it } from 'vitest';

import { NOTIFICATION_DEFAULTS, readNotificationOptions, spaceCallbacks } from './spaceCallbacks';

describe('readNotificationOptions', () => {
  it('keeps what a notification takes', () => {
    expect(readNotificationOptions({ appearance: 'danger', placement: 'bottom-left', autoDismiss: false })).toEqual({
      options: { appearance: 'danger', placement: 'bottom-left', autoDismiss: false },
      ignored: []
    });
  });

  /** A flow's values arrive as written: a word the step never offered is said, never shown as something else. */
  it('sets aside, by name, what it does not take', () => {
    expect(readNotificationOptions({ appearance: 'error', autoDismissTimeout: -5, placement: 'top-right' })).toEqual({
      options: { placement: 'top-right' },
      ignored: ['appearance', 'autoDismissTimeout']
    });
  });

  it('is the vocabulary the step offers, with its defaults', () => {
    const { params } = spaceCallbacks.addNotification;

    expect(params.appearance.default).toBe(NOTIFICATION_DEFAULTS.appearance);
    expect(params.placement.default).toBe(NOTIFICATION_DEFAULTS.placement);
  });
});
