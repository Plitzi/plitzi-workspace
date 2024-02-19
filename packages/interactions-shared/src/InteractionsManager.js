// Packages
import set from 'lodash/set';
import get from 'lodash/get';
import noop from 'lodash/noop';

// Monorepo
import EventBridge from '@plitzi/sdk-event-bridge';
import { EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import { flowTrigger } from '@repo/interactions-shared/InteractionsHelper';

class InteractionsManager {
  constructor(currentPageId = '', routeParams = {}, queryParams = {}) {
    this.eventBridge = new EventBridge();
    this.parentManager = undefined;
    this.childManagers = [];

    this.subscriptors = {};
    this.callbacksAvailables = {};
    this.interactionsRunning = {};

    this.interactionsData = { currentPageId, ...routeParams, ...queryParams };
  }

  eventBridgeCallback = interactions => async (subscriptorId, eventName, params) => {
    if (
      !interactions ||
      !eventName ||
      !subscriptorId ||
      get(this.interactionsRunning, `${subscriptorId}.${eventName}`)
    ) {
      return;
    }

    set(this.interactionsRunning, `${subscriptorId}.${eventName}`, true);

    const getAdditionalParams = get(this.subscriptors, `${subscriptorId}.getAdditionalParams`);
    let dataSource;
    if (typeof getAdditionalParams === 'function') {
      ({ dataSource } = getAdditionalParams() ?? {});
    }

    const triggersToRun = Object.values(interactions).filter(
      node => node.type === 'trigger' && node.action === eventName && node.enabled
    );

    await Promise.all(
      triggersToRun.map(trigger =>
        flowTrigger(
          trigger,
          interactions,
          this.getCallbacksAvailables(),
          { [trigger.id]: params },
          { ...this.interactionsData, ...dataSource, eventBridge: this.eventBridge }
        )
      )
    );

    set(this.interactionsRunning, `${subscriptorId}.${eventName}`, false);
  };

  subscribe(id, interactions = {}, triggers = {}, callbacks = {}, getAdditionalParams = noop) {
    set(this.subscriptors, id, { id, triggers, getAdditionalParams });

    const callbackKeys = Object.keys(callbacks);
    if (callbackKeys.length > 0) {
      this.callbacksAvailables[id] = callbackKeys.reduce((acum, callbackKey) => {
        const { title, callback, postCallback, params, preview, type } = callbacks[callbackKey];
        if (!callback || typeof callback !== 'function') {
          return acum;
        }

        return {
          ...acum,
          [callbackKey]: { title, callback, postCallback, action: callbackKey, elementId: id, params, preview, type }
        };
      }, {});
    }

    if (interactions && triggers && Object.keys(triggers).length > 0) {
      this.eventBridge.on(EventBridgeModuleTypes.INTERACTION, id, this.eventBridgeCallback(interactions), {
        override: true
      });
    }
  }

  unsubscribe(id) {
    this.eventBridge.off(EventBridgeModuleTypes.INTERACTION, id);
    delete this.subscriptors[id];
    if (this.callbacksAvailables[id]) {
      delete this.callbacksAvailables[id];
    }
  }

  getRootManager() {
    if (this.parentManager) {
      return this.parentManager.getRootManager();
    }

    return this;
  }

  _getSubscriptorInternal(subscriptorId) {
    let subscriptor = get(this.subscriptors, subscriptorId);
    if (!subscriptor && this.childManagers.length > 0) {
      for (const childManager of this.childManagers) {
        subscriptor = childManager._getSubscriptorInternal(subscriptorId);
        if (subscriptor) {
          break;
        }
      }
    }

    return subscriptor;
  }

  getSubscriptor(subscriptorId) {
    if (!this.parentManager) {
      return this._getSubscriptorInternal(subscriptorId);
    }

    const rootManager = this.getRootManager();

    return rootManager?._getSubscriptorInternal(subscriptorId);
  }

  _getCallbacksAvailablesInternal() {
    let callbacks = {};
    if (this.childManagers.length > 0) {
      for (const childManager of this.childManagers) {
        callbacks = { ...callbacks, ...childManager._getCallbacksAvailablesInternal() };
      }
    }

    return { ...callbacks, ...this.callbacksAvailables };
  }

  getCallbacksAvailables() {
    if (!this.parentManager) {
      return this._getCallbacksAvailablesInternal();
    }

    const rootManager = this.getRootManager();

    return rootManager?._getCallbacksAvailablesInternal();
  }

  interactionTrigger(subscriptorId, eventName, params = {}) {
    return this.eventBridge.emit(EventBridgeModuleTypes.INTERACTION, subscriptorId, subscriptorId, eventName, params);
  }

  // child managers

  createChildManager = () => {
    const childManager = new InteractionsManager(this.currentPageId, this.routeParams, this.queryParams);
    childManager.parentManager = this;
    this.childManagers.push(childManager);

    return childManager;
  };

  removeChildManager = childManager => {
    this.childManagers = this.childManagers.filter(manager => manager !== childManager);
  };
}

export default InteractionsManager;
