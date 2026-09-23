export type RuntimeState = Record<string, unknown>;

export type RuntimeStateInstance = {
  state: RuntimeState;
  setState: (value: RuntimeState | ((prev: RuntimeState) => RuntimeState)) => void;
  setStateByKey: (key: string, value: unknown) => void;
  clearState: () => void;
  /**
   * Called with the whole state after every change to it, until the returned function is called. What a host or a
   * plugin that keeps the state somewhere of its own — a store, a URL, an analytics call — listens to instead of
   * polling `state`.
   */
  subscribe: (listener: (state: RuntimeState) => void) => () => void;
};
