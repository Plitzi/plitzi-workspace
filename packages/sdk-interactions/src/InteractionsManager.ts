/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { get, set } from '@plitzi/plitzi-ui/helpers';

import EventBridge from '@plitzi/sdk-event-bridge';
import { KEY_TRIGGER } from '@plitzi/sdk-shared/helpers/keys';

import { flowTrigger } from './InteractionsHelper';

import type { EventBridgeCallback } from '@plitzi/sdk-event-bridge';
import type {
  ElementInteraction,
  EventBridgeEvent,
  InteractionCallback,
  QueryParams,
  RouteParams,
  Subscriptor,
  WhileRunning
} from '@plitzi/sdk-shared';

type InteractionUpdateListener = (timestamp: number) => void;

/**
 * Whether a key press is for this trigger.
 *
 * One press fires the key trigger ONCE, listing every shortcut it matched — fired once per flow instead, the second
 * would find the first still running and be dropped. So each flow on it runs only when its own `keys` is on the list.
 * Every other trigger answers whatever fires it.
 */
const answersPress = (node: ElementInteraction, payload: Record<string, unknown>): boolean => {
  if (node.action !== KEY_TRIGGER) {
    return true;
  }

  const { shortcuts } = payload;

  return Array.isArray(shortcuts) && shortcuts.includes(node.params.keys);
};

class InteractionsManager {
  eventBridge: InstanceType<typeof EventBridge>;
  parentManager?: InteractionsManager;
  childManagers: InteractionsManager[];
  interactionsData: Record<string, string | number | boolean>;
  subscriptors: Record<string, Subscriptor>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callbacksAvailables: Record<string, Record<string, InteractionCallback<any>>>;
  /**
   * The flows running now, by element and trigger node — what `whileRunning` decides against. Per FLOW rather than per
   * event: two flows on one click are two things, and one still running says nothing about the other.
   */
  private flowsRunning = new Map<string, Promise<void>>();
  lastUpdate: number;
  private listeners = new Set<InteractionUpdateListener>();

  constructor(currentPageId = '', routeParams: RouteParams = {}, queryParams: QueryParams = {}) {
    this.eventBridge = new EventBridge();
    this.parentManager = undefined;
    this.childManagers = [];

    this.subscriptors = {};
    this.callbacksAvailables = {};

    this.interactionsData = { currentPageId, ...routeParams, ...queryParams };
    this.lastUpdate = Date.now();
  }

  eventBridgeCallback =
    (interactions?: Record<string, ElementInteraction>) =>
    async (subscriptorId: string, eventName: string, params: Record<string, unknown>) => {
      if (!interactions || !eventName || !subscriptorId) {
        return;
      }

      const getAdditionalParams = get(this.subscriptors, `${subscriptorId}.getAdditionalParams`, undefined);
      // Read again before every step rather than once here: a step sees the page as it is when it runs.
      const readGlobals = (): Record<string, unknown> => ({
        ...this.interactionsData,
        ...(typeof getAdditionalParams === 'function' ? getAdditionalParams().dataSource : undefined)
      });

      const triggersToRun = Object.values(interactions).filter(
        (node: ElementInteraction) =>
          node.type === 'trigger' && node.action === eventName && node.enabled && answersPress(node, params)
      );

      await Promise.all(
        triggersToRun.map(trigger =>
          this.runFlow(`${subscriptorId}.${trigger.id}`, trigger.whileRunning ?? 'skip', () =>
            flowTrigger(
              trigger,
              interactions,
              this.getCallbacksAvailables(),
              { [trigger.id]: params },
              readGlobals,
              subscriptorId
            )
          )
        )
      );
    };

  /** One firing of one flow, as its trigger's `whileRunning` says — see {@link WhileRunning}. */
  private runFlow(key: string, whileRunning: WhileRunning, run: () => Promise<void>): Promise<void> {
    const running = this.flowsRunning.get(key);
    if (whileRunning === 'parallel') {
      return run();
    }

    if (running && whileRunning === 'skip') {
      return Promise.resolve();
    }

    // Queued behind the run in progress, if any; a run that failed does not stop the ones waiting for it.
    const next = (running ? running.then(run, run) : run()).finally(() => {
      if (this.flowsRunning.get(key) === next) {
        this.flowsRunning.delete(key);
      }
    });
    this.flowsRunning.set(key, next);

    return next;
  }

  // `id` is the element's id — the one name it answers to, and the only key an interaction is wired by. A caller
  // registered at all: its callbacks would be unreachable (nothing can name them) and its triggers would fire
  // against a key no flow can target, so the opaque id is never used as a substitute.
  subscribe<TParams extends Record<string, unknown> = Record<string, unknown>>(
    id: string,
    interactions: Record<string, ElementInteraction> = {},
    triggers: Record<string, InteractionCallback<TParams>> = {},
    callbacks: Record<string, InteractionCallback<TParams>> = {},
    getAdditionalParams?: Subscriptor<TParams>['getAdditionalParams']
  ) {
    if (!id || (this.subscriptors[id] as Subscriptor | undefined)) {
      return false;
    }

    set(this.subscriptors, id, { id, triggers, getAdditionalParams });
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

  private getSubscriptorInternal(subscriptorId: string): Subscriptor | undefined {
    let subscriptor = get(this.subscriptors, subscriptorId) as Subscriptor | undefined;
    if (!subscriptor && this.childManagers.length > 0) {
      for (const childManager of this.childManagers) {
        subscriptor = childManager.getSubscriptorInternal(subscriptorId);
        if (subscriptor) {
          break;
        }
      }
    }

    return subscriptor;
  }

  getSubscriptor(subscriptorId: string) {
    if (!this.parentManager) {
      return this.getSubscriptorInternal(subscriptorId);
    }

    const rootManager = this.getRootManager();

    return rootManager?.getSubscriptorInternal(subscriptorId);
  }

  private getCallbacksAvailablesInternal() {
    let callbacks: Record<string, Record<string, InteractionCallback>> = {};
    if (this.childManagers.length > 0) {
      for (const childManager of this.childManagers) {
        callbacks = { ...callbacks, ...childManager.getCallbacksAvailablesInternal() };
      }
    }

    return { ...callbacks, ...this.callbacksAvailables };
  }

  getCallbacksAvailables() {
    if (!this.parentManager) {
      return this.getCallbacksAvailablesInternal();
    }

    const rootManager = this.getRootManager();

    return rootManager?.getCallbacksAvailablesInternal() ?? {};
  }

  // `subscriptorId` is the firing element's id. Absent for a caller that passed none — it was never subscribed, so
  // there is nothing to fire and no key to fire against (the opaque id is deliberately not a fallback).
  interactionTrigger(subscriptorId: string | undefined, eventName: string, params: Record<string, unknown> = {}) {
    if (!subscriptorId) {
      return undefined;
    }

    return this.eventBridge.emit('interaction', subscriptorId as EventBridgeEvent, subscriptorId, eventName, params);
  }

  // Child managers

  createChildManager = (routeParams: Record<string, string> = {}, queryParams: Record<string, string> = {}) => {
    const childManager = new InteractionsManager(
      this.interactionsData.currentPageId as string,
      routeParams,
      queryParams
    );
    childManager.parentManager = this;
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
