// Packages
import moment from 'moment';

export const LOG_TYPE_INFO = 'info';
export const LOG_TYPE_WARNING = 'warning';
export const LOG_TYPE_DANGER = 'danger';

class PlitziConsole {
  callbackInternal = undefined;

  constructor(callback) {
    this.callbackInternal = callback;
  }

  setCallback(callback) {
    this.callbackInternal = callback;
  }

  #log(logType, category, message, params) {
    if (!this.callbackInternal) {
      return;
    }

    const time = moment().format('h:m:ss.SSS');
    this.callbackInternal(logType, category, message, params, time);
  }

  info(category, message, params) {
    this.#log(LOG_TYPE_INFO, category, message, params);
  }

  warning(category, message, params) {
    this.#log(LOG_TYPE_WARNING, category, message, params);
  }

  danger(category, message, params) {
    this.#log(LOG_TYPE_DANGER, category, message, params);
  }
}

export const pConsole = new PlitziConsole();

export default PlitziConsole;
