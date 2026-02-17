/* eslint-disable @typescript-eslint/no-dynamic-delete */

import get from 'lodash-es/get.js';
import set from 'lodash-es/set.js';

import EventBridge from '@plitzi/sdk-event-bridge';

import { flowTrigger } from './InteractionsHelper';

import type { EventBridgeCallback } from '@plitzi/sdk-event-bridge';
import type {
  ElementInteraction,
  EventBridgeEvent,
  InteractionCallback,
  QueryParams,
  RouteParams,
  Subscriptor
} from '@plitzi/sdk-shared';

type InteractionUpdateListener = (timestamp: number) => void;

class InteractionsManager {
  eventBridge: InstanceType<typeof EventBridge>;
  parentManager?: InteractionsManager;
  childManagers: InteractionsManager[];
  interactionsData: Record<string, string | number | boolean>;
  subscriptors: Record<string, Subscriptor>;
  callbacksAvailables: Record<string, Record<string, InteractionCallback>>;
  interactionsRunning: Record<string, boolean>;
  lastUpdate: number;
  private listeners = new Set<InteractionUpdateListener>();

  constructor(currentPageId = '', routeParams: RouteParams = {}, queryParams: QueryParams = {}) {
    this.eventBridge = new EventBridge();
    this.parentManager = undefined;
    this.childManagers = [];

    this.subscriptors = {};
    this.callbacksAvailables = {};
    this.interactionsRunning = {};

    this.interactionsData = { currentPageId, ...routeParams, ...queryParams };
    this.lastUpdate = Date.now();
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

  subscribe<TParams extends Record<string, unknown> = Record<string, unknown>>(
    id: string,
    interactions: Record<string, ElementInteraction> = {},
    triggers: Record<string, InteractionCallback<TParams>> = {},
    callbacks: Record<string, InteractionCallback<TParams>> = {},
    getAdditionalParams?: Subscriptor<TParams>['getAdditionalParams']
  ) {
    if (this.subscriptors[id] as Subscriptor | undefined) {
      return false;
    }

    set(this.subscriptors, id, {
      id,
      triggers,
      getAdditionalParams
    } as Subscriptor<TParams>);
    const callbackKeys = Object.keys(callbacks);
    if (callbackKeys.length > 0) {
      this.callbacksAvailables[id] = callbackKeys.reduce<Record<string, InteractionCallback<TParams>>>(
        (acum, callbackKey) => {
          const { title, callback, postCallback, params, preview, type } = callbacks[callbackKey];
          if (typeof callback !== 'function') {
            return acum;
          }

          return {
            ...acum,
            [callbackKey]: {
              elementId: id,
              title,
              action: callbackKey,
              type,
              callback,
              postCallback,
              params,
              preview
            } satisfies InteractionCallback<TParams>
          };
        },
        {}
      );
    }

    if (Object.keys(triggers).length > 0) {
      this.eventBridge.on(
        'interaction',
        id as EventBridgeEvent,
        this.eventBridgeCallback(interactions) as EventBridgeCallback,
        { override: true }
      );
    }

    this.touch();

    return true;
  }

  unsubscribe(id: string) {
    if (!(this.subscriptors[id] as Subscriptor | undefined)) {
      return false;
    }

    this.eventBridge.off('interaction', id as EventBridgeEvent);
    delete this.subscriptors[id];
    if (this.callbacksAvailables[id] as Record<string, InteractionCallback> | undefined) {
      delete this.callbacksAvailables[id];
    }

    this.touch();

    return true;
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
    let callbacks: Record<string, Record<string, InteractionCallback>> = {};
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

    return rootManager?._getCallbacksAvailablesInternal() ?? {};
  }

  interactionTrigger(subscriptorId: string, eventName: string, params: Record<string, unknown> = {}) {
    return this.eventBridge.emit('interaction', subscriptorId as EventBridgeEvent, subscriptorId, eventName, params);
  }

  // Child managers

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

  // Others

  onUpdate(listener: InteractionUpdateListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private touch(): void {
    const ts = Date.now();
    this.lastUpdate = ts;
    for (const listener of this.listeners) {
      listener(ts);
    }
  }
}

export default InteractionsManager;
