// A tiny external channel for the live log panel. A `loggerMiddleware` sink writes here on every committed store
// change; the panel reads it via useSyncExternalStore. It's deliberately separate from the game store — a logger
// sink writes somewhere else, it doesn't loop its own output back through the store it observes.
export type LogEntry = {
  id: number;
  path: string;
  value: string;
};

const listeners = new Set<() => void>();
let entries: LogEntry[] = [];
let nextId = 0;
let scheduled = false;

const flush = () => {
  scheduled = false;
  listeners.forEach(listener => listener());
};

export const pushLog = (path: string, value: unknown) => {
  entries = [{ id: nextId++, path, value: JSON.stringify(value) }, ...entries].slice(0, 80);
  // A store may commit its first change during a provider's render (middleware setup); notifying subscribers
  // synchronously there triggers React's "setState while rendering another component" warning. Defer + coalesce.
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
};

export const subscribeLog = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const getLogSnapshot = () => entries;
