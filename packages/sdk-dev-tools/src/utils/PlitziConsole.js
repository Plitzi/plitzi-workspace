class PlitziConsole {
  callbackInternal = undefined;

  constructor(callback) {
    this.callbackInternal = callback;
  }

  setCallback(callback) {
    this.callbackInternal = callback;
  }

  #log(logType, category, message, params) {
    this.callbackInternal(logType, category, message, params);
  }

  info(category, message, ...params) {
    this.#log('info', category, message, params);
  }

  warning(category, message, ...params) {
    this.#log('warning', category, message, params);
  }

  danger(category, message, ...params) {
    this.#log('danger', category, message, params);
  }
}

export const pConsole = new PlitziConsole();

export default PlitziConsole;
