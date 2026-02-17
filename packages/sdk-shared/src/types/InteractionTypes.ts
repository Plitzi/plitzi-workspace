/* eslint-disable @typescript-eslint/no-explicit-any */

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

export type InteractionParamType = 'boolean' | 'select' | 'text' | 'textarea' | 'codemirror-text' | 'codemirror-json';

export type InteractionCallbackParamValues<
  T extends Record<keyof InteractionCallback['params'], any> = Record<string, any>
> = T;

export type InteractionCallbackParamOption = { label: string; value: string };

export type InteractionCallbackParam<
  T extends Record<keyof InteractionCallback['params'], unknown> = Record<string, unknown>
> = {
  canBind?: boolean;
  label?: string;
  when?: boolean | ((params: InteractionCallbackParamValues<T>) => boolean);
} & (
  | { type: 'text'; defaultValue?: string | number }
  | { type: 'textarea'; defaultValue?: string }
  | { type: 'codemirror-text'; defaultValue?: string }
  | { type: 'codemirror-json'; defaultValue?: string }
  | { type: 'boolean'; defaultValue?: boolean }
  | {
      type: 'select';
      defaultValue?: string;
      options:
        | InteractionCallbackParamOption[]
        | ((params: InteractionCallbackParamValues<T>) => InteractionCallbackParamOption[]);
    }
  | {
      type: (params: InteractionCallbackParamValues<T>) => InteractionParamType;
      defaultValue?: string | number | boolean;
      options?:
        | { label: string; value: string }[]
        | ((params: InteractionCallbackParamValues<T>) => { label: string; value: string }[]);
    }
);

export type InteractionCallbackPreview = string | Record<string, unknown>;

export type InteractionCallbackPreviews = Record<string, InteractionCallbackPreview>;

export type InteractionCallback<
  T extends Record<keyof InteractionCallback['params'], unknown> = Record<string, unknown>
> = {
  elementId?: string; // When is globalCallback or utility, we just put the source as elementId
  action: string;
  title: string;
  type: InteractionCallbackType;
  params:
    | Record<string, InteractionCallbackParam<T>>
    | ((params: InteractionCallbackParamValues<T>) => Record<string, InteractionCallbackParam<T>>);
  callback?: (params: InteractionCallbackParamValues<T>) => unknown;
  postCallback?: InteractionPostCallback;
  preview?: InteractionCallbackPreviews | ((params: InteractionCallbackParamValues<T>) => InteractionCallbackPreviews);
  enabled?: boolean;
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

export type InteractionsContextValue<T = any> = {
  interactionsManager: T;
  useInteractions: (props: {
    id: string;
    interactions?: Record<string, ElementInteraction>;
    triggers?: Record<string, InteractionCallback>;
    callbacks?: Record<string, InteractionCallback>;
    getAdditionalParams?: Subscriptor['getAdditionalParams'];
  }) => void;
};
