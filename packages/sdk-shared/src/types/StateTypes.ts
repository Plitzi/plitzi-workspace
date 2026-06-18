export type RuntimeState = Record<string, unknown>;

export type RuntimeStateInstance = {
  state: RuntimeState;
  setState: (value: RuntimeState | ((prev: RuntimeState) => RuntimeState)) => void;
  setStateByKey: (key: string, value: unknown) => void;
  clearState: () => void;
};
