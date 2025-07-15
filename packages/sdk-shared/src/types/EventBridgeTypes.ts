// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventBridgeContextValue<T = any> = { eventBridge: T };

export type EventBridgeModule = 'main' | 'builder' | 'segment' | 'template' | 'interaction' | 'element';
