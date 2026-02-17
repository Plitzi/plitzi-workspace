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

export type InteractionCallbackParamValues<TParams extends Record<string, any> = Record<string, any>> = TParams;

export type InteractionCallbackParamOption = { label: string; value: string };

export type InteractionCallbackParam<TParams extends Record<string, unknown> = Record<string, unknown>> = {
  canBind?: boolean;
  label?: string;
  when?: boolean | ((params: InteractionCallbackParamValues<TParams>) => boolean);
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
        | ((params: InteractionCallbackParamValues<TParams>) => InteractionCallbackParamOption[]);
    }
  | {
      type: (params: InteractionCallbackParamValues<TParams>) => InteractionParamType;
      defaultValue?: string | number | boolean;
      options?:
        | { label: string; value: string }[]
        | ((params: InteractionCallbackParamValues<TParams>) => { label: string; value: string }[]);
    }
);

export type InteractionCallbackPreview = string | Record<string, unknown>;

export type InteractionCallbackPreviews = Record<string, InteractionCallbackPreview>;

export type InteractionCallback<TParams extends Record<string, unknown> = Record<string, unknown>> = {
  elementId?: string; // When is globalCallback or utility, we just put the source as elementId
  action: string;
  title: string;
  type: InteractionCallbackType;
  enabled?: boolean;
  params:
    | { [K in keyof TParams]: InteractionCallbackParam<TParams> }
    | ((params: InteractionCallbackParamValues<TParams>) => {
        [K in keyof TParams]: InteractionCallbackParam<TParams>;
      });
  callback?: (params: InteractionCallbackParamValues<TParams>) => unknown;
  postCallback?: InteractionPostCallback<TParams>;
  preview?:
    | InteractionCallbackPreviews
    | ((params: InteractionCallbackParamValues<TParams>) => InteractionCallbackPreviews);
};

export type Trigger<TParams extends Record<string, unknown> = Record<string, unknown>> = {
  title: string;
  preview?: InteractionCallbackPreviews | ((params: TParams) => InteractionCallbackPreviews);
  params:
    | { [K in keyof TParams]: InteractionCallbackParam<TParams> }
    | ((params: TParams) => { [K in keyof TParams]: InteractionCallbackParam<TParams> });
};

export type Subscriptor<TParams extends Record<string, unknown> = Record<string, unknown>> = {
  getAdditionalParams?: (params?: TParams) => { dataSource?: Record<string, unknown> };
  id: string;
  triggers: Record<string, Trigger<TParams>>;
};

export type InteractionsContextValue<TManager = any> = {
  interactionsManager: TManager;
  useInteractions: <TParams extends Record<string, unknown> = Record<string, unknown>>(props: {
    id: string;
    interactions?: Record<string, ElementInteraction>;
    triggers?: Record<string, InteractionCallback<TParams>>;
    callbacks?: Record<string, InteractionCallback<TParams>>;
    getAdditionalParams?: Subscriptor<TParams>['getAdditionalParams'];
  }) => void;
};
