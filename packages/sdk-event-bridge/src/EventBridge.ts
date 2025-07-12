/* eslint-disable @typescript-eslint/no-dynamic-delete */

import type { EventBridgeModule } from '@plitzi/sdk-shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventBridgeCallback<T = any> = (...data: T[]) => T | Promise<T>;

export type EventBridgeParams<T = unknown> = { filter?: (params?: T) => boolean; override?: boolean };

export type Event<T = unknown> = { callback: EventBridgeCallback<T>; filter?: EventBridgeParams<T>['filter'] };

export type EventBridgeProps<T = unknown> = {
  events?: Record<EventBridgeModule, Record<string, Event<T>[]>>;
};

class EventBridge<T = unknown> {
  events: Partial<Record<EventBridgeModule, Partial<Record<string, Event<T>[]>>>>;

  constructor({ events }: EventBridgeProps<T> | undefined = {}) {
    this.events = events ?? {};
  }

  has(module: EventBridgeModule, event: string) {
    if (!(module as string)) {
      throw new Error('Module name is required');
    }

    return this.events[module] && this.events[module][event];
  }

  on(module: EventBridgeModule, event: string, callback?: EventBridgeCallback<T>, params: EventBridgeParams<T> = {}) {
    const { filter, override = false } = params;
    if (!(module as string)) {
      throw new Error('Module name is required');
    }

    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.events[module]) {
      this.events[module] = {};
    }

    if (!this.events[module][event] || (override && this.events[module][event].length > 0)) {
      this.events[module][event] = [];
    }

    this.events[module][event].push({ callback, filter });
  }

  get(module: EventBridgeModule, event: string) {
    if (!this.has(module, event)) {
      return [];
    }

    return this.events[module]?.[event];
  }

  off(module: EventBridgeModule, event: string, callback?: EventBridgeCallback<T>) {
    if (!this.has(module, event) || !this.events[module]) {
      return;
    }

    if (callback) {
      this.events[module][event] = this.events[module][event]?.filter(eventItem => eventItem.callback !== callback);
    } else {
      this.events[module][event] = [];
    }

    if (this.events[module][event]?.length === 0) {
      delete this.events[module][event];
    }

    if (Object.keys(this.events[module]).length === 0) {
      delete this.events[module];
    }
  }

  emit(module: EventBridgeModule, events: string[] | string = [], ...data: T[]) {
    if (!Array.isArray(events) && events) {
      events = [events];
    }

    const promises: Promise<T>[] = [];
    (events as string[]).forEach(event => {
      if (!this.has(module, event)) {
        return;
      }

      const eventCallbacks = this.get(module, event);
      if (!eventCallbacks) {
        return;
      }

      eventCallbacks.forEach(eventItem => {
        const { callback, filter } = eventItem;
        if (!filter || typeof filter !== 'function' || filter(...data)) {
          promises.push(callback(...data) as Promise<T>);
        }
      });
    });

    return Promise.all(promises);
  }

  async emitWithResponse(module: EventBridgeModule, event: string, ...data: T[]) {
    if (!this.has(module, event)) {
      return undefined;
    }

    const events = this.get(module, event);
    if (!events) {
      return undefined;
    }

    const answers: Awaited<T>[] = await Promise.all(
      events
        .filter(eventItem => !eventItem.filter || eventItem.filter(...data))
        .map(eventItem => eventItem.callback(...data))
    );

    if (answers.length === 1) {
      return answers[0];
    }

    return answers;
  }

  once(module: EventBridgeModule, event: string, callback: EventBridgeCallback<T>, filter?: Event<T>['filter']) {
    if (!(module as string)) {
      throw new Error('Module name is required');
    }

    const onceCallback = async (data: T) => {
      await callback(data);
      this.off(module, event, onceCallback as EventBridgeCallback<T>);
    };

    this.on(module, event, onceCallback as EventBridgeCallback<T>, { filter });
  }

  clear(module?: EventBridgeModule) {
    if (!module) {
      this.events = {};

      return;
    }

    if (!this.events[module]) {
      return;
    }

    delete this.events[module];
  }

  getEvents(module?: EventBridgeModule) {
    if (!module) {
      return this.events;
    }

    if (!this.events[module]) {
      return {};
    }

    return this.events[module];
  }

  getModuleEventsNames(module: EventBridgeModule) {
    if (!(module as string) || !this.events[module]) {
      return [];
    }

    return Object.keys(this.events[module]);
  }

  getModuleEventsCount(module: EventBridgeModule) {
    return this.getModuleEventsNames(module).length;
  }
}

export default EventBridge;
