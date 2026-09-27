import { afterEach, describe, expect, it, vi } from 'vitest';

import PlitziConsole from './PlitziConsole';
import { formatDate } from '../../helpers';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlitziConsole', () => {
  it('stamps a log the way the general formatter would', () => {
    const date = new Date(2026, 8, 24, 7, 5, 3, 9);
    vi.useFakeTimers({ now: date });

    expect(new PlitziConsole().getTime(true)).toBe(formatDate(date, 'HH:mm:ss.SSS'));
    vi.useRealTimers();
  });

  it('keeps what nobody listens to yet in a browser, for the dev tools to show once they open', () => {
    vi.stubGlobal('window', {});
    const logger = new PlitziConsole();
    logger.info('store', 'sdk', {});
    const delivered = vi.fn();
    logger.setCallback(delivered);
    logger.processPendingLogs();

    expect(delivered).toHaveBeenCalledWith('info', 'store', 'sdk', {}, expect.any(String));
  });

  it('keeps nothing on a server, where it would hold other visitors’ logs for nobody', () => {
    vi.stubGlobal('window', undefined);
    const logger = new PlitziConsole();
    logger.info('store', 'sdk', { state: 'of another request' });

    expect(logger.pendingLogs).toEqual([]);
  });

  it('still delivers on a server to a listener that is there', async () => {
    vi.stubGlobal('window', undefined);
    const delivered = vi.fn();
    const logger = new PlitziConsole(delivered);
    logger.info('store', 'sdk', {});
    await Promise.resolve();

    expect(delivered).toHaveBeenCalledTimes(1);
  });
});
