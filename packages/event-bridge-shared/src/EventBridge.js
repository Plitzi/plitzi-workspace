// Packages
import noop from 'lodash/noop';
import pick from 'lodash/pick';

class EventBridge {
  constructor(props) {
    const { events = {} } = props || {};

    this.events = events;
  }

  has(module, event) {
    if (!module) {
      throw new Error('Module name is required');
    }

    return this.events[module] && this.events[module][event];
  }

  on(module, event, callback, params = {}) {
    const { filter = noop, override = false } = params;
    if (!module) {
      throw new Error('Module name is required');
    }

    if (callback && typeof callback !== 'function') {
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

  get(module, event) {
    if (!this.has(module, event)) {
      return [];
    }

    return this.events[module][event];
  }

  off(module, event, callback) {
    if (!this.has(module, event)) {
      return;
    }

    if (callback) {
      this.events[module][event] = this.events[module][event].filter(eventItem => eventItem.callback !== callback);
    } else {
      this.events[module][event] = [];
    }

    if (this.events[module][event].length === 0) {
      delete this.events[module][event];
    }

    if (Object.keys(this.events[module]).length === 0) {
      delete this.events[module];
    }
  }

  getCallbacks(module, event) {
    return Object.values(
      pick(
        this.eventsMap,
        Object.keys(this.events[module]).filter(key => key.includes(event))
      )
    ).reduce((acum, item) => [...acum, ...item], []);
  }

  emit(module, events, ...data) {
    if (!Array.isArray(events) && events) {
      events = [events];
    }

    const promises = [];
    events.forEach(event => {
      if (!this.has(module, event)) {
        return;
      }

      let eventCallbacks = this.get(module, event);
      if (!eventCallbacks) {
        return;
      }

      if (!Array.isArray(eventCallbacks) && typeof eventCallbacks === 'object') {
        eventCallbacks = this.getCallbacks(module, event);
      }

      eventCallbacks.forEach(eventItem => {
        const { callback, filter } = eventItem;
        if (!callback) {
          return;
        }

        if (!filter || typeof filter !== 'function' || filter === noop || filter(...data)) {
          promises.push(callback(...data));
        }
      });
    });

    return Promise.all(promises);
  }

  async emitWithResponse(module, event, ...data) {
    if (!this.has(module, event)) {
      return undefined;
    }

    const answers = [];
    await this.get(module, event).forEach(async eventItem => {
      const { callback, filter } = eventItem;
      if (!callback) {
        return;
      }

      if (!filter || typeof filter !== 'function' || filter === noop || filter(...data)) {
        const answer = await callback(...data);
        answers.push(answer);
      }
    });

    if (answers.length === 1) {
      return answers[0];
    }

    return answers;
  }

  once(module, event, callback, filter = noop) {
    if (!module) {
      throw new Error('Module name is required');
    }

    const onceCallback = data => {
      callback(data);
      this.off(module, event, onceCallback);
    };

    this.on(module, event, onceCallback, filter);
  }

  clear(module) {
    if (!module) {
      this.events = {};

      return;
    }

    if (!this.events[module]) {
      return;
    }

    delete this.events[module];
  }

  getEvents(module) {
    if (!module) {
      return this.events;
    }

    if (!this.events[module]) {
      return {};
    }

    return this.events[module];
  }

  getModuleEventsNames(module) {
    if (!module || !this.events[module]) {
      return [];
    }

    return Object.keys(this.events[module]);
  }

  getModuleEventsCount(module) {
    return this.getModuleEventsNames(module).length;
  }
}

export default EventBridge;
