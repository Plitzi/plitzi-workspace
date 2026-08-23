import { BUILTIN_GLOBAL_CALLBACKS } from './globalCallbacks';

import type { BuiltinGlobalCallback } from './globalCallbacks';
import type { StepSpec } from '@plitzi/sdk-schema';

/**
 * The steps a flow is made of, as functions.
 *
 * Three things go wrong when a step is written as a literal, and all three are silent. The `type` and the `on`
 * have to agree — a global callback registers under its SOURCE MODULE (`state`, `auth`, `actions`), an element
 * callback under an element's idRef, and a utility under nothing at all — so a step that names the wrong one
 * resolves to no function and the flow simply stops doing anything. There are two different `setState`s, one
 * global and one per element, with different params. And an invented param name is dropped on the way in.
 *
 * A builder answers all three from the declaration the source already published: the source module is looked up,
 * the type is fixed, and the params are typed.
 */

const globalStep = (action: string, params: Record<string, unknown> = {}): StepSpec => {
  const declared = BUILTIN_GLOBAL_CALLBACKS[action] as BuiltinGlobalCallback | undefined;
  // A builder naming an action no source declares would otherwise write a step that resolves to nothing at run
  // time, which is the exact failure this module exists to remove — so it is refused where it is written.
  if (!declared) {
    throw new Error(
      `No source declares the global callback "${action}". Declared: ${Object.keys(BUILTIN_GLOBAL_CALLBACKS).sort().join(', ')}.`
    );
  }

  return {
    type: 'globalCallback',
    action,
    title: declared.title,
    // Where the runtime looks the callback up: the module that registered it, never the element the flow sits on.
    on: declared.source,
    params
  };
};

/** Writes `runtime.state.<key>`. NOT the element `setState`, which changes one element's own attribute. */
export const setState = (params: { key: string; type: 'boolean' | 'number' | 'text'; value: unknown }): StepSpec =>
  globalStep('setState', params);

/** Empties `runtime.state` entirely. */
export const clearState = (): StepSpec => globalStep('clearState');

export const navigate = (params: { urlType: 'page' | 'internal' | 'external'; url: string }): StepSpec =>
  globalStep('navigate', params);

export const addNotification = (params: {
  content: string;
  placement?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
  appeareance?: 'success' | 'danger' | 'warning' | 'info';
  autoDismiss?: boolean;
  autoDismissTimeout?: number;
}): StepSpec => globalStep('addNotification', params);

/**
 * Signs in through whatever provider the space declared — `auth.login`, with no provider in the name.
 *
 * The action is `login` and not `authLogin`: the module is already `auth`, and the runtime registers these three
 * under the bare names. The function keeps its prefix only because this surface is exported flat, where a `login`
 * would be too vague to read at an import.
 */
export const authLogin = (
  params: { mode: 'normal'; username: string; password: string } | { mode: 'token'; token: string }
): StepSpec => globalStep('login', params);

export const authLogout = (): StepSpec => globalStep('logout');

export const authRefreshDetails = (): StepSpec => globalStep('refreshDetails');

/**
 * Runs one of the space's server actions.
 *
 * `mode` is the whole difference between a step whose result can be read and one whose cannot: only `await` puts
 * the answer in the flow scope, so a later step interpolating `{{ <id>.output.… }}` after a `detached` run reads
 * nothing. Give the step an `id` when something downstream reads it — that id IS the name the scope is keyed by.
 */
export const runServerAction = (params: {
  actionId: string;
  /**
   * The values the action is given. **Write an object.**
   *
   * A string is accepted because the builder's editor is a JSON box, and it is the form that quietly breaks: the
   * moment an interpolated value carries a quotation mark or a newline — a post body, a comment, an address — the
   * text stops being JSON, and a run whose input will not parse posts `{}` rather than refusing. As an object each
   * value is its own string and nothing has to be escaped by hand.
   */
  input?: string | Record<string, unknown>;
  mode?: 'await' | 'detached' | 'stream';
  idempotencyKey?: string;
}): StepSpec => globalStep('runServerAction', { mode: 'await', input: {}, ...params });

export const cancelServerAction = (params: { runId: string }): StepSpec => globalStep('cancelServerAction', params);

/**
 * A utility runs on nothing: the runtime resolves it by action alone, so it carries no `on` at all — the one kind
 * of step where naming an element is the mistake.
 */
const utilityStep = (action: string, params: Record<string, unknown> = {}): StepSpec => ({
  type: 'utility',
  action,
  params
});

/** Milliseconds. The param is `time` — not `delay`, `duration` or `ms`, any of which waits zero. */
export const delay = (time: number): StepSpec => utilityStep('delayTime', { time });

export const webHook = (params: { url: string; method?: string; body?: string }): StepSpec =>
  utilityStep('webHook', params);

export const twigTemplate = (params: { template: string }): StepSpec => utilityStep('twigTemplate', params);
