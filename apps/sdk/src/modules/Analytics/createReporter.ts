import type { AnalyticsConfig } from '@plitzi/sdk-shared';

export type ReporterEvent = {
  id: string;
  type: 'render' | 'interaction' | 'custom';
  ts: number;
  page: { path: string; title?: string };
  ref?: { referrer?: string; utm?: Record<string, string> };
  name?: string;
  props?: Record<string, string | number | boolean>;
};

export type Reporter = {
  /** A page came into view — the first paint of a client-side render, or an SPA route change. */
  trackRender: () => void;
  /** A named thing the visitor did. */
  track: (name: string, props?: Record<string, string | number | boolean>) => void;
  /** Sends whatever is queued. Called on a full batch, on a timer, and when the page goes away. */
  flush: () => void;
  /** Stops the timer and sends what is left. */
  stop: () => void;
};

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

const readUtm = (): Record<string, string> | undefined => {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      utm[key.slice(4)] = value;
    }
  }

  return Object.keys(utm).length > 0 ? utm : undefined;
};

// The id exists to make an event idempotent: `sendBeacon` on a flaky unload and the retry after a lost flush
// both deliver the same event, and the server drops the repeat by this id.
const eventId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * The browser's half of analytics: SPA route changes, named interactions, and the first view of a render the
 * server never saw. It reports what only the browser knows, and it is trusted with nothing else — the page
 * views behind an invoice are counted server-side, at the SSR render and the schema fetch, where a visitor
 * has no say. So a hostile client here can pollute a dashboard, never a bill.
 *
 * Events are batched and sent with `sendBeacon`, which survives the page going away — the flush on
 * `visibilitychange` is the only one that reliably runs on a real navigation, and it is exactly the one that
 * `fetch` would have lost.
 */
export const createReporter = (config: AnalyticsConfig, batchSize = 20, flushIntervalMs = 5000): Reporter => {
  const queue: ReporterEvent[] = [];
  const endpoint = `${config.endpoint.replace(/\/+$/, '')}/batch?k=${encodeURIComponent(config.key)}`;
  let timer: ReturnType<typeof setInterval> | undefined;

  const send = (events: ReporterEvent[]): void => {
    const body = JSON.stringify({ events });

    // The key rides in the query string, not a header: `sendBeacon` cannot set one. The endpoint accepts
    // either, and only this path can send during unload.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const delivered = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      if (delivered) {
        return;
      }
    }

    // Beacon refused (over its size cap, or unavailable). keepalive gives fetch the same survive-unload
    // property; a failure here is dropped on purpose — analytics must never surface an error to a visitor.
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      mode: 'no-cors'
    }).catch(() => undefined);
  };

  const flush = (): void => {
    if (queue.length === 0) {
      return;
    }

    send(queue.splice(0, queue.length));
  };

  const enqueue = (event: ReporterEvent): void => {
    queue.push(event);
    if (queue.length >= batchSize) {
      flush();
    }
  };

  const currentPage = (): ReporterEvent['page'] => ({
    path: window.location.pathname,
    title: document.title || undefined
  });

  if (typeof window !== 'undefined') {
    timer = setInterval(flush, flushIntervalMs);

    // 'hidden' is the last moment a page is reliably alive — a tab switch, a swipe away, a closed window. The
    // pagehide listener covers the browsers that still skip it on back/forward navigation.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    });
    window.addEventListener('pagehide', flush);
  }

  return {
    trackRender: () => {
      enqueue({
        id: eventId(),
        type: 'render',
        ts: Date.now(),
        page: currentPage(),
        ref: { referrer: document.referrer || undefined, utm: readUtm() }
      });
    },
    track: (name, props) => {
      enqueue({ id: eventId(), type: 'interaction', ts: Date.now(), page: currentPage(), name, props });
    },
    flush,
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }

      flush();
    }
  };
};
