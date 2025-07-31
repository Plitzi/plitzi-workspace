import type { ElementInteraction } from './SchemaTypes';
import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

export type InteractionCallbackType = 'trigger' | 'globalCallback' | 'callback' | 'utility';
export type InteractionStatus = 'completed' | 'skipped';
export type InteractionNodeStatus = 'success' | 'failed' | 'skipped' | 'disabled';

export type InteractionPostCallback<T = Record<string, unknown>> = (
  params: InteractionCallbackParamValues & T,
  callbackResult?: unknown
) => unknown;

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

export type InteractionParamType = 'boolean' | 'select' | 'text';
export type InteractionCallbackParamValues = Record<keyof InteractionBaseCallback['params'], unknown>;
export type InteractionCallbackParam = {
  canBind?: boolean;
  label?: string;
  when?: boolean | ((params: InteractionCallbackParamValues) => boolean);
} & (
  | { type: 'text'; defaultValue?: string | number }
  | { type: 'textarea'; defaultValue?: string }
  | { type: 'boolean'; defaultValue?: boolean }
  | {
      type: 'select';
      defaultValue?: string;
      options:
        | { label: string; value: string }[]
        | ((params: InteractionCallbackParamValues) => { label: string; value: string }[]);
    }
  | {
      type: (params: InteractionCallbackParamValues) => InteractionParamType;
      defaultValue?: unknown;
      options?:
        | { label: string; value: string }[]
        | ((params: InteractionCallbackParamValues) => { label: string; value: string }[]);
    }
);

export type InteractionCallbackPreview = string | Record<string, string>;
export type InteractionCallbackPreviews = Record<string, InteractionCallbackPreview>;

export type InteractionBaseCallback = {
  title: string;
  type: InteractionCallbackType;
  params: Record<string, InteractionCallbackParam>;
  callback?: (params: InteractionCallbackParamValues) => unknown;
  postCallback?: InteractionPostCallback;
  preview?: InteractionCallbackPreviews;
  enabled?: boolean;
};

export type InteractionCallback = InteractionBaseCallback & {
  action: string; // Name of the action
  elementId: string; // When is globalCallback or utility, we just put the source as elementId
};

export type Trigger = {
  title: InteractionCallback['title'];
  preview?: InteractionCallback['preview'];
  params: InteractionCallback['params'];
};

export type Subscriptor<T = unknown> = {
  getAdditionalParams?: (params?: T) => { dataSource?: Record<string, unknown> };
  id: string;
  triggers: Record<string, Trigger>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InteractionsContextValue<T = any> = {
  interactionsManager: T;
  useInteractions: (props: {
    id: string;
    interactions?: Record<string, ElementInteraction>;
    triggers?: Record<string, InteractionBaseCallback>;
    callbacks?: Record<string, InteractionBaseCallback>;
    getAdditionalParams?: Subscriptor['getAdditionalParams'];
  }) => void;
};
