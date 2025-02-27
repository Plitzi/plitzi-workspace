/* eslint-disable @typescript-eslint/no-dynamic-delete */
// Packages
import get from 'lodash/get';
import set from 'lodash/set';

// Monorepo
import EventBridge from '@plitzi/sdk-event-bridge';
import { EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Relatives
import { flowTrigger } from './InteractionsHelper';

// Types
import type { EventBridgeCallback } from '@plitzi/sdk-event-bridge';
import type { ElementInteraction, InteractionBaseCallback, Subscriptor } from '@plitzi/sdk-shared';

class InteractionsManager {
  eventBridge: InstanceType<typeof EventBridge>;
  parentManager?: InteractionsManager;
  childManagers: InteractionsManager[];
  interactionsData: Record<string, string | number | boolean>;
  subscriptors: Record<string, Subscriptor>;
  callbacksAvailables: Record<string, Record<string, InteractionBaseCallback> | undefined>;
  interactionsRunning: Record<string, boolean>;

  constructor(currentPageId = '', routeParams: Record<string, string> = {}, queryParams: Record<string, string> = {}) {
    this.eventBridge = new EventBridge();
    this.parentManager = undefined;
    this.childManagers = [];

    this.subscriptors = {};
    this.callbacksAvailables = {};
    this.interactionsRunning = {};

    this.interactionsData = { currentPageId, ...routeParams, ...queryParams };
  }

  eventBridgeCallback =
    (interactions?: Record<string, ElementInteraction>) =>
    async (subscriptorId: string, eventName: string, params: Record<string, unknown>) => {
      if (
        !interactions ||
        !eventName ||
        !subscriptorId ||
        get(this.interactionsRunning, `${subscriptorId}.${eventName}`)
      ) {
        return;
      }

      set(this.interactionsRunning, `${subscriptorId}.${eventName}`, true);

      const getAdditionalParams = get(
        this.subscriptors,
        `${subscriptorId}.getAdditionalParams`,
        undefined
      ) as Subscriptor['getAdditionalParams'];
      let dataSource: unknown;
      if (typeof getAdditionalParams === 'function') {
        ({ dataSource } = getAdditionalParams());
      }

      const triggersToRun = Object.values(interactions).filter(
        (node: ElementInteraction) => node.type === 'trigger' && node.action === eventName && node.enabled
      );

      await Promise.all(
        triggersToRun.map(trigger =>
          flowTrigger(
            trigger,
            interactions,
            this.getCallbacksAvailables(),
            { [trigger.id]: params },
            {
              ...this.interactionsData,
              ...(dataSource as Record<string, unknown>),
              eventBridge: this.eventBridge
            }
          )
        )
      );

      set(this.interactionsRunning, `${subscriptorId}.${eventName}`, false);
    };

  subscribe(
    id: string,
    interactions: Record<string, ElementInteraction> = {},
    triggers: Record<string, InteractionBaseCallback> = {},
    callbacks: Record<string, InteractionBaseCallback> = {},
    getAdditionalParams: Subscriptor['getAdditionalParams']
  ) {
    set(this.subscriptors, id, { id, triggers, getAdditionalParams });

    const callbackKeys = Object.keys(callbacks);
    if (callbackKeys.length > 0) {
      this.callbacksAvailables[id] = callbackKeys.reduce((acum, callbackKey) => {
        const { title, callback, postCallback, params, preview, type } = callbacks[callbackKey];
        if (typeof callback !== 'function') {
          return acum;
        }

        return {
          ...acum,
          [callbackKey]: { title, callback, postCallback, action: callbackKey, elementId: id, params, preview, type }
        };
      }, {});
    }

    if (Object.keys(triggers).length > 0) {
      this.eventBridge.on(
        EventBridgeModuleTypes.INTERACTION,
        id,
        this.eventBridgeCallback(interactions) as EventBridgeCallback,
        { override: true }
      );
    }
  }

  unsubscribe(id: string) {
    this.eventBridge.off(EventBridgeModuleTypes.INTERACTION, id);
    delete this.subscriptors[id];
    if (this.callbacksAvailables[id]) {
      delete this.callbacksAvailables[id];
    }
  }

  getRootManager(): this | undefined {
    if (this.parentManager) {
      return this.parentManager.getRootManager() as this | undefined;
    }

    return this;
  }

  _getSubscriptorInternal(subscriptorId: string): Subscriptor | undefined {
    let subscriptor = get(this.subscriptors, subscriptorId) as Subscriptor | undefined;
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

  getSubscriptor(subscriptorId: string) {
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

  interactionTrigger(subscriptorId: string, eventName: string, params: Record<string, unknown> = {}) {
    return this.eventBridge.emit(EventBridgeModuleTypes.INTERACTION, subscriptorId, subscriptorId, eventName, params);
  }

  // child managers

  createChildManager = (routeParams: Record<string, string> = {}, queryParams: Record<string, string> = {}) => {
    const childManager = new InteractionsManager(
      this.interactionsData.currentPageId as string,
      routeParams,
      queryParams
    );
    childManager.parentManager = this as InteractionsManager;
    this.childManagers.push(childManager);

    return childManager;
  };

  removeChildManager = (childManager: InteractionsManager) => {
    this.childManagers = this.childManagers.filter(manager => manager !== childManager);
  };
}

export default InteractionsManager;
