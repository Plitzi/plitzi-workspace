// The SDK's built-in interaction sources register their `globalCallback` actions under a fixed module id, NOT under
// the element that hosts the flow: the runtime resolves a global callback as `callbacksAvailables[elementId][action]`
// (see sdk-interactions/InteractionsHelper), and these callbacks live on the source module — `space`, `state`,
// `navigation`, `auth`. A node that stored the host element's idRef here would resolve to nothing and
// the flow would silently do nothing. SSR has no runtime handle on these React sources, so this catalog is a
// faithful, hand-maintained mirror of what each source declares (source id + the FULL param schema each callback
// exposes in the builder). Mirror any change to the sdk-interactions sources here.

import { reconcileParams } from './paramSpec';

import type { ParamSpec } from './paramSpec';

export interface BuiltinGlobalCallback {
  // The registration id the runtime looks the callback up under — the value a node's `elementId` must carry.
  source: string;
  title: string;
  // When true the param set is CLOSED: only the keys in `params` are valid, so any other key the agent supplies is a
  // mistake (dropped on apply, warned in validation). Every built-in closes its set: there is no callback whose
  // params are open-ended, so an unknown key is always an error rather than a payload the server understands.
  strictParams: boolean;
  // The full param schema the builder exposes for this callback — the authoritative list of valid params, their
  // meaning, defaults, options and conditional visibility.
  params: ParamSpec;
}

export const BUILTIN_GLOBAL_CALLBACKS: Record<string, BuiltinGlobalCallback> = {
  addNotification: {
    source: 'space',
    title: 'Add Notification',
    strictParams: true,
    params: {
      content: {
        type: 'textarea',
        // The single most-confused param: `content` IS the notification's message/body. There is no `title`,
        // `message` or `type` param — put the user-facing text here.
        description:
          'The notification text shown to the user — this is the message body. There is no separate title/message/type param.',
        default: 'Content'
      },
      placement: {
        type: 'select',
        description: 'Where the toast appears on screen.',
        default: 'top-right',
        options: ['top-right', 'top-center', 'top-left', 'bottom-right', 'bottom-center', 'bottom-left']
      },
      appeareance: {
        type: 'select',
        // Intentionally the misspelling the SDK source uses — the runtime reads exactly this key.
        description: 'Visual style of the notification. NOTE: the key is spelled "appeareance".',
        default: 'success',
        options: ['success', 'danger', 'warning', 'info']
      },
      autoDismiss: {
        type: 'boolean',
        description: 'Whether the notification dismisses itself after a timeout.',
        default: true
      },
      autoDismissTimeout: {
        type: 'number',
        description: 'Milliseconds before auto-dismiss. Only applies when autoDismiss is true.',
        default: 5000,
        when: params => params.autoDismiss === true
      }
    }
  },
  setState: {
    source: 'state',
    title: 'Set State',
    strictParams: true,
    params: {
      key: { type: 'text', description: 'The state key/path to set.', default: '' },
      type: {
        type: 'select',
        description: 'The value type.',
        options: ['boolean', 'number', 'text']
      },
      value: {
        // Polymorphic: the stored value is coerced to whatever `type` selects (boolean/number/text), so it may be a
        // real boolean or number, not only a string.
        type: 'scalar',
        description: 'The value to store — its type follows the `type` param (a real boolean/number, or text).',
        when: params => Boolean(params.type)
      }
    }
  },
  clearState: { source: 'state', title: 'Clear State', strictParams: true, params: {} },
  navigate: {
    source: 'navigation',
    title: 'Navigate',
    strictParams: true,
    params: {
      urlType: {
        type: 'select',
        description: 'Target kind: a space page, an internal space path, or an external URL.',
        options: ['page', 'internal', 'external']
      },
      url: {
        type: 'text',
        description: 'Destination — a page id when urlType is "page", otherwise a URL/path.',
        when: params => Boolean(params.urlType)
      }
    }
  },
  authLogin: { source: 'auth', title: 'Auth Login', strictParams: true, params: {} },
  authLogout: { source: 'auth', title: 'Auth Logout', strictParams: true, params: {} },
  authRefreshDetails: { source: 'auth', title: 'Auth Refresh Details', strictParams: true, params: {} }
};

/** The built-in globalCallback for an action, or undefined when the action is not a known built-in (a plugin
 *  callback whose source/schema is not knowable here). */
export const getGlobalCallback = (action: string): BuiltinGlobalCallback | undefined =>
  Object.hasOwn(BUILTIN_GLOBAL_CALLBACKS, action) ? BUILTIN_GLOBAL_CALLBACKS[action] : undefined;

/** Resolve a `globalCallback` action against the built-in catalog: returns the module id it is registered under
 *  (`source`) and the params reconciled to the callback's schema — unknown keys dropped for a closed callback, then
 *  missing defaults filled. An action the catalog does not know (e.g. a plugin callback) yields no source and
 *  unchanged params, so the caller keeps its own behavior for it. */
export const applyBuiltinCallback = (
  action: string,
  params: Record<string, unknown>
): { source?: string; params: Record<string, unknown> } => {
  if (!(action in BUILTIN_GLOBAL_CALLBACKS)) {
    return { params };
  }

  const builtin = BUILTIN_GLOBAL_CALLBACKS[action];

  return { source: builtin.source, params: reconcileParams(params, builtin.params, builtin.strictParams) };
};
