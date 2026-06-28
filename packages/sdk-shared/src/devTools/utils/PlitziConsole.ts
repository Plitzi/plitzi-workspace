import { formatDate } from '../../helpers';

import type { Log, LogInteraction, LogNavigation, ProviderCallback } from '../../types/DevToolsTypes';
import type { ChangeListener } from '@plitzi/nexus';

type CallbackInternal = (
  logType: Log['logType'],
  category: Log['category'],
  message: Log['message'],
  params: Record<string, unknown> | Log['params'],
  time?: Log['time']
) => void;

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
    const time = this.getTime(true);
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

  addProviderMethod(methodName: string, callback: ProviderCallback) {
    this.callbackAddProvider?.(methodName, callback);
  }

  removeProviderMethod(methodName: string) {
    if (typeof this.callbackRemoveProvider === 'function') {
      this.callbackRemoveProvider(methodName);
    }
  }

  // Methods

  getTime(asString: true): string;
  getTime(asString?: false): Date;
  getTime(asString = false): string | Date {
    const now = new Date();
    if (!asString) {
      return now;
    }

    return formatDate(now, 'HH:mm:ss.SSS');
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
