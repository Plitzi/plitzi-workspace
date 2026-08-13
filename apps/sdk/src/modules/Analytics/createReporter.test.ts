import { beforeEach, describe, it, expect, vi } from 'vitest';

import { createReporter } from './createReporter';

import type { AnalyticsConfig } from '@plitzi/sdk-shared';

const config: AnalyticsConfig = { endpoint: 'https://api.test/v1/collect', key: 'space-token' };

const sendBeacon = vi.fn((_url: string, _body?: BodyInit | null) => true);

// What was posted, parsed back out of the Blob the beacon carried.
const sentEvents = async (call = 0): Promise<{ type: string; name?: string; page: { path: string } }[]> => {
  const blob = sendBeacon.mock.calls[call][1] as unknown as Blob;
  const parsed = JSON.parse(await blob.text()) as { events: { type: string; name?: string; page: { path: string } }[] };

  return parsed.events;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { sendBeacon });
  window.history.replaceState({}, '', '/pricing');
});

describe('Analytics/createReporter', () => {
  it('sends the key in the URL, because a beacon cannot set a header', () => {
    const reporter = createReporter(config, 1);
    reporter.trackRender();

    expect(sendBeacon.mock.calls[0][0]).toBe('https://api.test/v1/collect/batch?k=space-token');
    reporter.stop();
  });

  it('batches until the size threshold, then flushes once', async () => {
    const reporter = createReporter(config, 3);

    reporter.track('a');
    reporter.track('b');
    expect(sendBeacon).not.toHaveBeenCalled();

    reporter.track('c');
    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(await sentEvents()).toHaveLength(3);

    reporter.stop();
  });

  it('captures the path the event happened on', async () => {
    const reporter = createReporter(config, 1);
    reporter.trackRender();

    expect((await sentEvents())[0].page.path).toBe('/pricing');
    reporter.stop();
  });

  it('gives every event a distinct id, so a retried batch can be de-duplicated server-side', async () => {
    const reporter = createReporter(config, 2);
    reporter.track('a');
    reporter.track('b');

    const blob = sendBeacon.mock.calls[0][1] as unknown as Blob;
    const parsed = JSON.parse(await blob.text()) as { events: { id: string }[] };
    expect(new Set(parsed.events.map(event => event.id)).size).toBe(2);

    reporter.stop();
  });

  it('sends nothing when the queue is empty', () => {
    const reporter = createReporter(config);
    reporter.flush();

    expect(sendBeacon).not.toHaveBeenCalled();
    reporter.stop();
  });

  // The flush that matters: a real navigation is the moment a page's last events would otherwise be lost.
  it('flushes when the page is hidden', () => {
    const reporter = createReporter(config, 100);
    reporter.track('a');

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(sendBeacon).toHaveBeenCalledOnce();
    reporter.stop();
  });

  it('flushes what is left when stopped', () => {
    const reporter = createReporter(config, 100);
    reporter.track('a');
    reporter.stop();

    expect(sendBeacon).toHaveBeenCalledOnce();
  });

  it('reports interactions with their name and props', async () => {
    const reporter = createReporter(config, 1);
    reporter.track('signup', { plan: 'pro' });

    const [event] = await sentEvents();
    expect(event.type).toBe('interaction');
    expect(event.name).toBe('signup');

    reporter.stop();
  });
});
