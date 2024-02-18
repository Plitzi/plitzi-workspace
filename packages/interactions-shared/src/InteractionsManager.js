// Packages
import set from 'lodash/set';
import get from 'lodash/get';
import noop from 'lodash/noop';

// Monorepo
import EventBridge from '@repo/event-bridge-shared';
import { EventBridgeModuleTypes } from '@repo/event-bridge-shared/EventBridgeHelper';
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
          this.callbacksAvailables,
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
        const { title, callback, postCallback, params, preview } = callbacks[callbackKey];
        if (!callback || typeof callback !== 'function') {
          return acum;
        }

        return {
          ...acum,
          [callbackKey]: { title, callback, postCallback, action: callbackKey, elementId: id, params, preview }
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

  getSubscriptor(subscriptorId) {
    get(this.subscriptors, subscriptorId);
  }

  getCallbacksAvailables() {
    return this.callbacksAvailables;
  }

  interactionTrigger(subscriptorId, eventName, params = {}) {
    return this.eventBridge.emit(EventBridgeModuleTypes.INTERACTION, subscriptorId, subscriptorId, eventName, params);
  }
}

export default InteractionsManager;
