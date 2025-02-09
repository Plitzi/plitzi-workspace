// Packages
import moment from 'moment';

// Types
import type { Log, LogInteraction, LogNavigation, ProviderCallback } from '../DevToolsContext';
import type { Moment } from 'moment';

export const LOG_TYPE_INFO = 'info';
export const LOG_TYPE_WARNING = 'warning';
export const LOG_TYPE_DANGER = 'danger';
export const LOG_TYPE_SUCCESS = 'success';
export const LOG_TYPE_CUSTOM = 'custom';

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
  listening: boolean = false;
  listeningCategory?: Log['category'];
  logsListened: Log[] = [];
  listeningParams?: { category: Log['category'] };

  constructor(callback?: CallbackInternal) {
    this.callbackInternal = callback;
  }

  // Integration

  setCallback(callback?: CallbackInternal) {
    this.callbackInternal = callback;
  }

  setCallbackAddProvider(callback?: CallbackAddProvider) {
    this.callbackAddProvider = callback;
  }

  setCallbackRemoveProvider(callback?: CallbackRemoveProvider) {
    this.callbackRemoveProvider = callback;
  }

  // Private Methods

  #log(logType: Log['logType'], category: Log['category'], message: Log['message'], params: Log['params']) {
    if (!this.callbackInternal) {
      return;
    }

    const time = this.getTime(true);
    if (!this.listening) {
      this.callbackInternal(logType, category, message, params, time);
    } else if (category === 'navigation') {
      this.logsListened.push({ logType, category, message, params, time } as Log & LogNavigation);
    } else {
      this.logsListened.push({ logType, category, message, params, time } as Log & LogInteraction);
    }
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
  getTime(asString?: false): Moment;
  getTime(asString = false): string | Moment {
    if (!asString) {
      return moment();
    }

    return moment().format('HH:mm:ss.SSS');
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

export default PlitziConsole;
