import type { Log, LogInteraction, LogNavigation, ProviderCallback } from '../../types/DevToolsTypes';
import type { ChangeListener } from '@plitzi/nexus';

type CallbackInternal = (
  logType: Log['logType'],
  category: Log['category'],
  message: Log['message'],
  params: Record<string, unknown> | Log['params'],
  time?: Log['time']
) => void;

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/**
 * `HH:mm:ss.SSS` in local time, by hand. Every log is stamped, and the SDK logs every store change, so a general
 * date formatter here was a measurable share of rendering a page.
 */
const clockTime = (date: Date): string =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;

/**
 * Whether a log nobody listens to yet may be kept for whoever listens later — the dev tools opening on a page that
 * has been running. Only in a browser: a server process renders for everyone, so what it kept would be other
 * visitors' logs, delivered to nobody and holding their state in memory.
 */
const canDeliverLater = (): boolean => typeof window !== 'undefined';

type CallbackAddProvider = (methodName: string, callback: ProviderCallback) => void;

type CallbackRemoveProvider = (methodName: string) => void;

class PlitziConsole {
  callbackInternal?: CallbackInternal;
  callbackAddProvider?: CallbackAddProvider;
  callbackRemoveProvider?: CallbackRemoveProvider;
  pendingLimit: number = 100;
  logsListenedLimit: number = 1000;
  pendingLogs: Log[] = [];
  listening: boolean = false;
  listeningCategory?: Log['category'];
  logsListened: Log[] = [];
  listeningParams?: { category: Log['category'] };
  #deliveryQueue: Log[] = [];
  #flushScheduled = false;
  #listeners = new Set<(log: Log) => void>();
  /** The last logs written, for a listener that arrives after them — a page's dev tools mount after its first flows. */
  #recent: Log[] = [];
  recentLimit: number = 1000;

  constructor(callback?: CallbackInternal, pendingLimit: number = 100) {
    this.callbackInternal = callback;
    this.pendingLimit = pendingLimit;
  }

  // Integration

  setCallback(callback?: CallbackInternal) {
    this.callbackInternal = callback;
  }

  processPendingLogs() {
    if (this.pendingLogs.length && this.callbackInternal) {
      for (const log of this.pendingLogs) {
        this.callbackInternal(log.logType, log.category, log.message, log.params, log.time);
      }

      this.pendingLogs = [];
    }
  }

  /**
   * Every log as it is written, beside whatever panel takes them — what a reader in text (the agent inspector) keeps
   * for itself. Only in a browser, as everything kept here is. `replay` hands it the last ones written first: the
   * flows a page runs as it loads end before anything mounted later could have been listening.
   */
  addListener(listener: (log: Log) => void, { replay = false }: { replay?: boolean } = {}): () => void {
    if (replay) {
      for (const log of this.#recent) {
        listener(log);
      }
    }

    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * The last logs written, oldest first: what a panel mounting again starts from. Its logs lived in its own state, and
   * opening the panel from the badge moved it in the page's layout — React mounted it again, empty: the badge said a
   * warning and the panel showed none. Only in a browser, as everything kept here is.
   */
  history(): Log[] {
    return [...this.#recent];
  }

  /** The history and what waits for a panel emptied: a panel's Clear empties what it starts from next time too. */
  clearHistory() {
    this.#recent = [];
    this.pendingLogs = [];
  }

  /** What waited for a panel dropped, once the panel took the history that holds it. */
  dropPending() {
    this.pendingLogs = [];
  }

  setCallbackAddProvider(callback?: CallbackAddProvider) {
    this.callbackAddProvider = callback;
  }

  setCallbackRemoveProvider(callback?: CallbackRemoveProvider) {
    this.callbackRemoveProvider = callback;
  }

  flush(hard = false) {
    this.logsListened = [];

    if (hard) {
      this.pendingLogs = [];
    }
  }

  // Private Methods

  #log(logType: Log['logType'], category: Log['category'], message: Log['message'], params: Log['params']) {
    if (!this.callbackInternal && !canDeliverLater()) {
      return;
    }

    const time = this.getTime(true);
    if (canDeliverLater()) {
      // The category and its params arrive as two arguments; together they are one of `Log`'s cases.
      const log = { logType, category, message, params, time } as Log;
      this.#recent.push(log);
      if (this.#recent.length > this.recentLimit) {
        this.#recent.shift();
      }

      for (const listener of this.#listeners) {
        listener(log);
      }
    }

    if (!this.callbackInternal) {
      this.pendingLogs.push({ logType, category, message, params, time } as Log);
      if (this.pendingLogs.length > this.pendingLimit) {
        this.pendingLogs.shift();
      }

      return;
    }

    if (!this.listening) {
      this.#deliveryQueue.push({ logType, category, message, params, time } as Log);
      this.#scheduleDelivery();
    } else if (category === 'navigation') {
      this.logsListened.push({ logType, category, message, params, time } as Log & LogNavigation);
    } else {
      this.logsListened.push({ logType, category, message, params, time } as Log & LogInteraction);
    }

    if (this.logsListened.length > this.logsListenedLimit) {
      this.logsListened.shift();
    }
  }

  #scheduleDelivery() {
    if (this.#flushScheduled) {
      return;
    }

    this.#flushScheduled = true;
    queueMicrotask(() => {
      this.#flushScheduled = false;
      const callback = this.callbackInternal;
      const queue = this.#deliveryQueue;
      this.#deliveryQueue = [];
      if (!callback) {
        return;
      }

      for (const log of queue) {
        callback(log.logType, log.category, log.message, log.params, log.time);
      }
    });
  }

  // Methods providers

  /**
   * Kept here, whoever listens: an element registers its methods as it mounts, often before the panel does, and what was
   * registered then was lost — the panel and `window.__plitzi` read the same registry.
   */
  #providers = new Map<string, ProviderCallback>();

  addProviderMethod(methodName: string, callback: ProviderCallback) {
    this.#providers.set(methodName, callback);
    this.callbackAddProvider?.(methodName, callback);
  }

  removeProviderMethod(methodName: string) {
    this.#providers.delete(methodName);
    if (typeof this.callbackRemoveProvider === 'function') {
      this.callbackRemoveProvider(methodName);
    }
  }

  /** Every method registered now, by name: what a panel mounting late starts from. */
  providerMethods(): Record<string, ProviderCallback> {
    return Object.fromEntries(this.#providers);
  }

  /** What a registered method answers — undefined when none is registered by that name. */
  providerData(methodName: string, ...args: unknown[]): unknown {
    const method = this.#providers.get(methodName);

    return method === undefined ? undefined : method(...args);
  }

  // Methods

  getTime(asString: true): string;
  getTime(asString?: false): Date;
  getTime(asString = false): string | Date {
    const now = new Date();
    if (!asString) {
      return now;
    }

    return clockTime(now);
  }

  info(category: Log['category'], message: Log['message'], params: Log['params']) {
    this.#log('info', category, message, params);
  }

  warning(category: Log['category'], message: Log['message'], params: Log['params']) {
    this.#log('warning', category, message, params);
  }

  danger(category: Log['category'], message: Log['message'], params: Log['params']) {
    this.#log('danger', category, message, params);
  }

  success(category: Log['category'], message: Log['message'], params: Log['params']) {
    this.#log('success', category, message, params);
  }

  begin(category: Log['category']) {
    this.listening = true;
    this.listeningParams = { category };
  }

  end() {
    this.listening = false;
    if (this.listeningCategory && this.logsListened.length > 0) {
      this.callbackInternal?.(
        'info',
        this.listeningCategory,
        `${this.logsListened.length} Log${this.logsListened.length === 1 ? '' : 's'}`,
        { logs: this.logsListened }
      );
    }

    this.logsListened = [];
    this.listeningCategory = undefined;
  }
}

export const pConsole = new PlitziConsole();

export function createStoreDevToolsLogger<TState extends object>(storeName = 'store'): ChangeListener<TState> {
  return ({ path, prevValue, nextValue }) => {
    pConsole.info('store', storeName, { storeName, path, prev: prevValue, next: nextValue });
  };
}

export default PlitziConsole;
