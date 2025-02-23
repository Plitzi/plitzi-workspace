// Types
import type { ElementInteraction } from './SchemaTypes';
import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

export type InteractionStatus = 'completed' | 'skipped';
export type InteractionNodeStatus = 'success' | 'failed' | 'skipped' | 'disabled';

export type InteractionPostCallback<T = Record<string, unknown>> = (params?: T, callbackResult?: unknown) => unknown;

export type PostCallbackNode<T = Record<string, unknown>> = {
  id: string;
  callback?: InteractionPostCallback<T>;
  params: ElementInteraction['params'];
};

export type InteractionNode = {
  node: ElementInteraction;
  status: InteractionNodeStatus;
  postCallbacks: PostCallbackNode[];
  result?: unknown;
  startTime: number;
  endTime: number;
  whenParams?: Record<string, RuleValue>;
};

export type InteractionCallback<T = Record<string, unknown>> = {
  title: string;
  type: ElementInteraction['type'];
  action: string;
  elementId: string;
  callback?: (params?: T) => unknown;
  postCallback?: InteractionPostCallback<T>;
  preview?: Record<string, unknown>;
  params: T;
  enabled?: boolean;
};

export type InteractionType = 'boolean';

export type InteractionParams<T = unknown> = {
  canBind?: boolean;
  defaultValue?: T;
  type?: InteractionType;
  label?: string;
};

export type Trigger<T = unknown> = {
  title: string;
  preview?: Record<string, unknown>;
  params: Record<string, InteractionParams<T>>;
};

export type Subscriptor<T = unknown> = {
  getAdditionalParams?: (params?: T) => { dataSource?: Record<string, unknown> };
  id: string;
  triggers: Record<string, Trigger<T>>;
};

export type InteractionsContextValue<T = unknown> = {
  interactionsManager: T;
  useInteractions: (props: {
    id: string;
    interactions?: Record<string, ElementInteraction>;
    triggers?: Record<string, InteractionCallback>;
    callbacks?: Record<string, InteractionCallback>;
    getAdditionalParams?: Subscriptor['getAdditionalParams'];
  }) => void;
};
