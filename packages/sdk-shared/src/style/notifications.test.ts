import { describe, expect, it } from 'vitest';

import { notificationsCss, notificationsProblem, splitNotificationsCss, withNotificationsCss } from './notifications';

describe('notifications', () => {
  it('says what is wrong with a spec instead of refusing it, for an editor to show', () => {
    expect(notificationsProblem({ background: 'var(--card)' })).toBeUndefined();
    expect(notificationsProblem({ colour: 'red' })).toContain('has no "colour"');
    expect(notificationsProblem({ background: 'red; } body {' })).toContain('not one CSS value');
  });

  it('writes and reads back the rule, apart from the own CSS of the space', () => {
    const written = withNotificationsCss('.a{}', { radius: '12px' });

    expect(notificationsCss({ radius: '12px' })).toContain('--toastify-toast-bd-radius: 12px;');
    expect(splitNotificationsCss(written)).toEqual({ notifications: { radius: '12px' }, customCss: '.a{}' });
  });
});
