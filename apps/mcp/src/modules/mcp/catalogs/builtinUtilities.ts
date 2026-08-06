import { reconcileParams, unknownParams } from './paramSpec';

import type { ParamSpec } from './paramSpec';

// Built-in `utility`-type actions (mirror of sdk-interactions/utility). A utility is NOT provided by any element or
// source module — the runtime resolves it as `utility[action]`, so its node `elementId` is irrelevant. This catalog
// is the authoritative list of valid utility actions and their EXACT param names — the class of mistake it guards
// against is an invented param (e.g. `delay` on delayTime instead of `time`, which leaves the wait at 0ms).

export interface BuiltinUtility {
  title: string;
  // When true the param set is CLOSED: any key not listed is a mistake (dropped on apply, warned in validation).
  strictParams: boolean;
  params: ParamSpec;
}

export const BUILTIN_UTILITIES: Record<string, BuiltinUtility> = {
  delayTime: {
    title: 'Delay Time',
    strictParams: true,
    params: {
      time: {
        type: 'number',
        // The param is `time`, NOT `delay`/`duration`/`ms` — the runtime does setTimeout(resolve, time), so a wrong
        // key leaves time undefined and the step resolves immediately.
        description: 'Milliseconds to wait before the next step runs. The key is "time" (not "delay").'
      }
    }
  },
  twigTemplate: {
    title: 'Twig Template',
    strictParams: true,
    params: {
      returnMode: {
        type: 'select',
        description: 'How the rendered template is returned.',
        default: 'text',
        options: ['text', 'json', 'jsonObject']
      },
      template: {
        type: 'textarea',
        description: 'The Twig template string to render against the flow/global params.'
      }
    }
  },
  webHook: {
    title: 'Webhook',
    strictParams: true,
    params: {
      url: { type: 'text', description: 'The URL to call.' },
      method: {
        type: 'select',
        description: 'HTTP method.',
        default: 'get',
        options: ['get', 'post', 'put', 'delete', 'patch', 'head']
      },
      body: { type: 'textarea', description: 'Request body.' },
      authorizationToken: { type: 'text', description: 'Value sent as the Authorization header.' },
      credentials: {
        type: 'select',
        description: 'fetch credentials mode.',
        default: 'same-origin',
        options: ['include', 'omit', 'same-origin']
      }
    }
  }
};

/** The built-in utility for an action, or undefined when the action is not a known built-in utility. */
export const getUtility = (action: string): BuiltinUtility | undefined =>
  Object.hasOwn(BUILTIN_UTILITIES, action) ? BUILTIN_UTILITIES[action] : undefined;

/** Param keys the agent supplied that are not valid for a built-in utility (only for CLOSED sets). [] for an unknown
 *  action (a utility whose schema is not known here). */
export const unknownUtilityParams = (action: string, params: Record<string, unknown>): string[] => {
  const utility = getUtility(action);
  if (!utility || !utility.strictParams) {
    return [];
  }

  return unknownParams(params, utility.params);
};

/** Reconcile a `utility` action against the utility catalog: unknown keys dropped for a closed utility, then missing
 *  defaults filled. An unknown action yields unchanged params. */
export const applyUtility = (
  action: string,
  params: Record<string, unknown>
): { known: boolean; params: Record<string, unknown> } => {
  const utility = getUtility(action);
  if (!utility) {
    return { known: false, params };
  }

  return { known: true, params: reconcileParams(params, utility.params, utility.strictParams) };
};
