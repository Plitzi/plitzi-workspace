/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ElementInteraction } from './SchemaTypes';
import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

export type InteractionCallbackType = 'trigger' | 'globalCallback' | 'callback' | 'utility';
export type InteractionStatus = 'completed' | 'skipped';
export type InteractionNodeStatus = 'success' | 'failed' | 'skipped' | 'disabled';

export type InteractionPostCallback<T extends Record<string, unknown> = Record<string, unknown>> = (
  params: InteractionCallbackParamValues<T>,
  callbackResult?: unknown
) => unknown;

export type PostCallbackNode<T extends Record<string, unknown> = Record<string, unknown>> = {
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

export type InteractionCallbackParamValues<T extends Record<string, unknown> = Record<string, unknown>> = T;

export type InteractionCallbackParam<T extends Record<string, unknown> = Record<string, unknown>> = {
  canBind?: boolean;
  label?: string;
  when?: boolean | ((params: InteractionCallbackParamValues<T>) => boolean);
} & (
  | { type: 'text'; defaultValue?: string | number }
  | { type: 'textarea'; defaultValue?: string | number }
  | { type: 'codemirror-text'; defaultValue?: string }
  | { type: 'codemirror-json'; defaultValue?: string }
  | { type: 'boolean'; defaultValue?: boolean }
  | {
      type: 'select';
      defaultValue?: string;
      options:
        | { label: string; value: string }[]
        | ((params: InteractionCallbackParamValues<T>) => { label: string; value: string }[]);
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

export type InteractionCallback<T extends Record<string, unknown> = Record<string, unknown>> = {
  elementId?: string; // When is globalCallback or utility, we just put the source as elementId
  action: string;
  title: string;
  type: InteractionCallbackType;
  enabled?: boolean;
  params:
    | Record<keyof T, InteractionCallbackParam<T>>
    | ((params: InteractionCallbackParamValues<T>) => Record<keyof T, InteractionCallbackParam<T>>);
  callback?: (params: InteractionCallbackParamValues<T>) => unknown;
  postCallback?: InteractionPostCallback<T>;
  preview?: InteractionCallbackPreviews | ((params: InteractionCallbackParamValues<T>) => InteractionCallbackPreviews);
};

export type Trigger<T extends Record<string, unknown> = Record<string, unknown>> = {
  title: string;
  preview?: InteractionCallbackPreviews | ((params: T) => InteractionCallbackPreviews);
  params:
    | { [K in keyof T]: InteractionCallbackParam<T> }
    | ((params: T) => { [K in keyof T]: InteractionCallbackParam<T> });
};

export type Subscriptor<T extends Record<string, unknown> = Record<string, unknown>> = {
  getAdditionalParams?: (params?: T) => { dataSource?: Record<string, unknown> };
  id: string;
  triggers: Record<string, Trigger<T>>;
};

export type InteractionsContextValue<TManager = any> = {
  interactionsManager: TManager;
  useInteractions: <T extends Record<string, unknown> = Record<string, unknown>>(props: {
    id: string;
    interactions?: Record<string, ElementInteraction>;
    triggers?: Record<string, InteractionCallback<T>>;
    callbacks?: Record<string, InteractionCallback<T>>;
    getAdditionalParams?: Subscriptor<T>['getAdditionalParams'];
  }) => void;
};
