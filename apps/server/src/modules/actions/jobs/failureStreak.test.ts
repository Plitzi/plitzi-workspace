import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFailureStreak } from './failureStreak';
import { serverLog } from '../../../helpers/serverLog';

/**
 * A pass that runs again by itself — a sweep, a claim, a heartbeat — reports failing by how long it has been failing:
 * a store dropping its connections for a moment is not an incident, and one that stays down is.
 */

const spies = () => ({
  warn: vi.spyOn(serverLog, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(serverLog, 'error').mockImplementation(() => {}),
  info: vi.spyOn(serverLog, 'info').mockImplementation(() => {})
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a failing pass that runs again by itself', () => {
  it('is a warning with its reason, not an error with a stack, the first time', () => {
    const { warn, error } = spies();
    const streak = createFailureStreak('Actions', 'schedule sweep', 60_000, () => 0);

    streak.failed(new Error('Connection to localhost:27010 interrupted due to server monitor timeout'));

    expect(warn).toHaveBeenCalledWith(
      'Actions',
      'schedule sweep failed, trying again',
      'Connection to localhost:27010 interrupted due to server monitor timeout'
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('says nothing more while the streak is young, and nothing at all once it ends quietly', () => {
    const { warn, error, info } = spies();
    let now = 0;
    const streak = createFailureStreak('Actions', 'schedule sweep', 60_000, () => now);

    streak.failed(new Error('down'));
    now = 15_000;
    streak.failed(new Error('down'));
    streak.succeeded();

    expect(warn).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('is the error, with the cause, once it has kept failing for a minute — and says when it recovers', () => {
    const { error, info } = spies();
    let now = 0;
    const streak = createFailureStreak('Actions', 'schedule sweep', 60_000, () => now);
    const cause = new Error('still down');

    streak.failed(cause);
    now = 60_000;
    streak.failed(cause);
    now = 75_000;
    streak.failed(cause);
    now = 90_000;
    streak.succeeded();

    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith('Actions', 'schedule sweep has been failing for 60s', cause);
    expect(info).toHaveBeenCalledWith('Actions', 'schedule sweep is working again, after 3 failures over 90s');
  });

  it('starts a new streak after a recovery', () => {
    const { warn } = spies();
    const streak = createFailureStreak('Actions', 'job claim', 60_000, () => 0);

    streak.failed(new Error('a'));
    streak.succeeded();
    streak.failed(new Error('b'));

    expect(warn).toHaveBeenCalledTimes(2);
  });
});
