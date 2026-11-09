import type { GuestHost } from './types';

/**
 * Events, abort and timers: `Event`, `EventTarget`, `AbortSignal`, `AbortController` and the timers, on the runner's clock.
 *
 * Printed into the isolate on its own, as the guest is (`isolate.ts`): it may use nothing but its parameters.
 */
export const guestEvents = (host: Pick<GuestHost, 'sleep'>) => {
  type Listener = (event: GuestEvent) => void;

  class GuestEvent {
    readonly type: string;

    constructor(type: string) {
      this.type = type;
    }
  }

  /**
   * Each target's listeners, kept out of the object the code holds — a WeakMap rather than a private field, so the
   * part's type can be named outside it (`GuestEvents`).
   */
  const listenersOf = new WeakMap<object, Map<string, Map<Listener, { once: boolean }>>>();

  const listenersFor = (target: object): Map<string, Map<Listener, { once: boolean }>> => {
    const listeners = listenersOf.get(target) ?? new Map<string, Map<Listener, { once: boolean }>>();
    listenersOf.set(target, listeners);

    return listeners;
  };

  class GuestEventTarget {
    addEventListener(type: string, listener: Listener | null, options?: boolean | { once?: boolean }): void {
      if (!listener) {
        return;
      }

      const listeners = listenersFor(this).get(type) ?? new Map<Listener, { once: boolean }>();
      listeners.set(listener, { once: typeof options === 'object' && options.once === true });
      listenersFor(this).set(type, listeners);
    }

    removeEventListener(type: string, listener: Listener | null): void {
      if (listener) {
        listenersFor(this).get(type)?.delete(listener);
      }
    }

    dispatchEvent(event: GuestEvent): boolean {
      const listeners = listenersFor(this).get(event.type);
      [...(listeners ?? new Map<Listener, { once: boolean }>())].forEach(([listener, { once }]) => {
        if (once) {
          listeners?.delete(listener);
        }

        listener.call(this, event);
      });

      return true;
    }
  }

  const signals = new WeakMap<GuestAbortSignal, { aborted: boolean; reason: unknown }>();
  const CONSTRUCT = Symbol('AbortSignal');

  class GuestAbortSignal extends GuestEventTarget {
    onabort: Listener | null = null;

    constructor(token?: symbol) {
      super();
      if (token !== CONSTRUCT) {
        throw new TypeError('Illegal constructor: an AbortSignal comes from an AbortController');
      }

      signals.set(this, { aborted: false, reason: undefined });
    }

    get aborted(): boolean {
      return signals.get(this)?.aborted ?? false;
    }

    get reason(): unknown {
      return signals.get(this)?.reason;
    }

    throwIfAborted(): void {
      if (this.aborted) {
        throw this.reason;
      }
    }

    static abort(reason?: unknown): GuestAbortSignal {
      const signal = new GuestAbortSignal(CONSTRUCT);
      abortSignal(signal, reason);

      return signal;
    }

    static timeout(ms: number): GuestAbortSignal {
      const signal = new GuestAbortSignal(CONSTRUCT);
      guestSetTimeout(() => {
        abortSignal(signal, new DOMException('The operation timed out.', 'TimeoutError'));
      }, ms);

      return signal;
    }

    static any(sources: GuestAbortSignal[]): GuestAbortSignal {
      const signal = new GuestAbortSignal(CONSTRUCT);
      const aborted = sources.find(source => source.aborted);
      if (aborted) {
        abortSignal(signal, aborted.reason);

        return signal;
      }

      sources.forEach(source => {
        source.addEventListener('abort', () => abortSignal(signal, source.reason), { once: true });
      });

      return signal;
    }
  }

  const abortSignal = (signal: GuestAbortSignal, reason: unknown): void => {
    const state = signals.get(signal);
    if (!state || state.aborted) {
      return;
    }

    state.aborted = true;
    state.reason = reason === undefined ? new DOMException('This operation was aborted', 'AbortError') : reason;
    const event = new GuestEvent('abort');
    signal.onabort?.call(signal, event);
    signal.dispatchEvent(event);
  };

  class GuestAbortController {
    readonly signal = new GuestAbortSignal(CONSTRUCT);

    abort(reason?: unknown): void {
      abortSignal(this.signal, reason);
    }
  }

  const timers = new Set<number>();
  let nextTimer = 1;
  const delayOf = (ms: unknown) => Math.max(0, Number(ms) || 0);

  const guestSetTimeout = (callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): number => {
    const id = nextTimer++;
    timers.add(id);
    void host.sleep(delayOf(ms)).then(() => {
      if (timers.delete(id)) {
        callback(...args);
      }
    });

    return id;
  };

  const guestSetInterval = (callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): number => {
    const id = nextTimer++;
    timers.add(id);
    const tick = (): void => {
      void host.sleep(Math.max(1, delayOf(ms))).then(() => {
        if (timers.has(id)) {
          callback(...args);
          tick();
        }
      });
    };
    tick();

    return id;
  };

  const clearTimer = (id?: number): void => {
    if (id !== undefined) {
      timers.delete(id);
    }
  };

  return {
    GuestEvent,
    GuestEventTarget,
    GuestAbortSignal,
    GuestAbortController,
    guestSetTimeout,
    guestSetInterval,
    clearTimer
  };
};

export type GuestEvents = ReturnType<typeof guestEvents>;
