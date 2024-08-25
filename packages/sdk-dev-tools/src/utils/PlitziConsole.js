// Packages
import moment from 'moment';

export const LOG_TYPE_INFO = 'info';
export const LOG_TYPE_WARNING = 'warning';
export const LOG_TYPE_DANGER = 'danger';
export const LOG_TYPE_SUCCESS = 'success';

class PlitziConsole {
  callbackInternal = undefined;

  listening = false;

  listeningCategory = '';

  logsListened = [];

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

    const time = moment().format('HH:mm:ss.SSS');
    if (!this.listening) {
      this.callbackInternal(logType, category, message, params, time);
    } else {
      this.logsListened.push({ logType, category, message, params, time });
    }
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

  success(category, message, params) {
    this.#log(LOG_TYPE_SUCCESS, category, message, params);
  }

  begin(category = '') {
    this.listening = true;
    this.listeningParams = { category };
  }

  end() {
    this.listening = false;
    if (this.listeningCategory && this.logsListened.length > 0) {
      this.callbackInternal(
        LOG_TYPE_INFO,
        this.listeningCategory,
        `${this.logsListened.length} Log${this.logsListened === 1 ? '' : 's'}`,
        { logs: this.logsListened }
      );
    }

    this.logsListened = [];
    this.listeningCategory = '';
  }
}

export const pConsole = new PlitziConsole();

export default PlitziConsole;
