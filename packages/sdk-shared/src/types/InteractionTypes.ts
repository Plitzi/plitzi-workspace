/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ElementInteraction } from './SchemaTypes';
import type { SpaceCredentialProvider } from './SpaceTypes';
import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

// `task` is server-only: it runs inside a server action, never in the browser. It is not a `utility` — those are
// resolved by action alone and offered in CLIENT flows, where a task has nothing to run on — and not a
// `globalCallback`, which names a client source module.
export type InteractionCallbackType = 'trigger' | 'globalCallback' | 'callback' | 'utility' | 'task';
// `failed` means the flow ran to the end but at least one of its steps did: a flow does not abort on a failed step,
// so the aggregate status reports the worst outcome rather than the fact that the traversal finished.
export type InteractionStatus = 'completed' | 'skipped' | 'failed';
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

export type InteractionParamType =
  'boolean' | 'select' | 'text' | 'number' | 'textarea' | 'codemirror-text' | 'codemirror-json' | 'elements';

export type InteractionCallbackParamValues<T extends Record<string, unknown> = Record<string, unknown>> = T;

export type InteractionCallbackParam<T extends Record<string, unknown> = Record<string, unknown>> = {
  canBind?: boolean;
  label?: string;
  when?: boolean | ((params: InteractionCallbackParamValues<T>) => boolean);
  /**
   * This param names one of the space's credentials, of this provider. Serializable on purpose: an editor offers the
   * space's credentials of that kind to pick from, rather than a text box somebody has to type an identifier into.
   */
  credentialProvider?: SpaceCredentialProvider;
  /**
   * A space's task refuses to run without it — empty, or only spaces — saying so with the param's `label`, before its
   * code runs: what a task otherwise checked by hand in its first lines.
   */
  required?: boolean;
} &
  /** Handed to a task as text, whatever was written or bound — a number as its digits — at most `maxLength` long. */
  (
    | { type: 'text'; defaultValue?: string | number; maxLength?: number }
    /** Written as text — a number or a template — and handed to the callback as a number, within `min` and `max`. */
    | { type: 'number'; defaultValue?: number; min?: number; max?: number }
    | { type: 'textarea'; defaultValue?: string | number; maxLength?: number }
    | { type: 'codemirror-text'; defaultValue?: string }
    | { type: 'codemirror-json'; defaultValue?: string }
    | { type: 'boolean'; defaultValue?: boolean }
    | {
        /**
         * Several elements of the space, stored as their ids. The editor offers the elements of `elementType` to pick
         * from — it is the one that knows the page — so a step never asks for ids typed by hand.
         */
        type: 'elements';
        defaultValue?: string[];
        elementType?: string;
      }
    | {
        type: 'select';
        defaultValue?: string;
        options:
          | { label: string; value: string }[]
          | ((params: InteractionCallbackParamValues<T>) => { label: string; value: string }[]);
      }
    | {
        type: (params: InteractionCallbackParamValues<T>) => InteractionParamType;
        defaultValue?: string | number | boolean | string[];
        options?:
          | { label: string; value: string }[]
          | ((params: InteractionCallbackParamValues<T>) => { label: string; value: string }[]);
      }
  );

/**
 * What a field a step or a trigger hands its flow looks like — a sample, shown where a flow is written, never sent: `0`
 * for a count, `false` for a flag, `[]` for a list, as well as the text `''`.
 */
export type InteractionCallbackPreview = string | number | boolean | null | unknown[] | Record<string, unknown>;

export type InteractionCallbackPreviews = Record<string, InteractionCallbackPreview>;

/**
 * What a callback learns about the flow running it.
 *
 * Only the element the flow fired on, and only because a step that starts something asynchronous has to be able to
 * report back TO that element — a server action running detached finishes long after the flow that launched it
 * returned, and `onFlowEnd` has to fire somewhere specific.
 */
export type InteractionCallbackContext = {
  /** Id of the element this flow fired on. Absent for a flow with no host element. */
  hostElementId?: string;
  /**
   * Aborted when the flow running this step is superseded — its trigger fired again under `whileRunning: 'latest'`. A
   * step waiting on something it can stop (a request, a server run) stops it; the flow starts no further step.
   */
  signal?: AbortSignal;
};

export type InteractionCallback<T extends Record<string, unknown> = Record<string, unknown>> = {
  elementId?: string; // When is globalCallback or utility, we just put the source as elementId
  action: string;
  title: string;
  type: InteractionCallbackType;
  /**
   * The heading the editor's picker lists it under, when that is not its type's: a space's own functions are tasks to
   * the run, and a category of their own to whoever picks a step.
   */
  group?: string;
  enabled?: boolean;
  params:
    | Record<keyof T, InteractionCallbackParam<T>>
    | ((params: InteractionCallbackParamValues<T>) => Record<keyof T, InteractionCallbackParam<T>>);
  callback?: (params: InteractionCallbackParamValues<T>, context?: InteractionCallbackContext) => unknown;
  postCallback?: InteractionPostCallback<T>;
  preview?: InteractionCallbackPreviews | ((params: InteractionCallbackParamValues<T>) => InteractionCallbackPreviews);
};

export type Trigger<T extends Record<string, unknown> = Record<string, unknown>> = {
  title: string;
  preview?: InteractionCallbackPreviews | ((params: T) => InteractionCallbackPreviews);
  params:
    { [K in keyof T]: InteractionCallbackParam<T> } | ((params: T) => { [K in keyof T]: InteractionCallbackParam<T> });
};

export type Subscriptor<T extends Record<string, unknown> = Record<string, unknown>> = {
  getAdditionalParams?: (params?: T) => { dataSource?: Record<string, unknown> };
  id: string;
  triggers: Record<string, Trigger<T>>;
};

export type InteractionsContextValue<TManager = any> = {
  interactionsManager: TManager;
  useInteractions: <T extends Record<string, unknown> = Record<string, unknown>>(props: {
    // The element's id — the key interactions wire by, and the same name the builder's tree shows.
    id?: string;
    interactions?: Record<string, ElementInteraction>;
    triggers?: Record<string, InteractionCallback<T>>;
    callbacks?: Record<string, InteractionCallback<T>>;
    getAdditionalParams?: Subscriptor<T>['getAdditionalParams'];
  }) => void;
};

/**
 * What an embedding application offers a space it renders.
 *
 * The one direction that did not exist: a space acts on its own state, its own router and its own session, and had
 * no way to ask the application AROUND it for anything — so every application shell had to be written in the host's
 * own code, which is the one part of a product that cannot then be authored or themed without a release.
 *
 * Keyed by the name a space's `hostAction` step calls. A name the host did not register does nothing.
 */
export type HostActions = Record<string, (params: Record<string, unknown>) => void>;
