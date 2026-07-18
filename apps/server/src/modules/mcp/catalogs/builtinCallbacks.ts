// The SDK's built-in interaction sources register their `globalCallback` actions under a fixed module id, NOT under
// the element that hosts the flow: the runtime resolves a global callback as `callbacksAvailables[elementId][action]`
// (see sdk-interactions/InteractionsHelper), and these callbacks live on the source module — `space`, `state`,
// `navigation`, `auth`, `collection`. A node that stored the host element's idRef here would resolve to nothing and
// the flow would silently do nothing. SSR has no runtime handle on these React sources, so this catalog is a
// faithful, hand-maintained mirror of what each source declares (source id + the FULL param schema each callback
// exposes in the builder). Mirror any change to the sdk-interactions sources here.

import { reconcileParams, unknownParams } from './paramSpec';

import type { ParamSpec } from './paramSpec';

export interface BuiltinGlobalCallback {
  // The registration id the runtime looks the callback up under — the value a node's `elementId` must carry.
  source: string;
  title: string;
  // When true the param set is CLOSED: only the keys in `params` are valid, so any other key the agent supplies is a
  // mistake (dropped on apply, warned in validation). When false (collection callbacks) the set is OPEN — the record
  // carries arbitrary per-collection field values on top of the listed params — so extra keys are left untouched.
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
      value: { type: 'text', description: 'The value to store.', when: params => Boolean(params.type) }
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
  authRefreshDetails: { source: 'auth', title: 'Auth Refresh Details', strictParams: true, params: {} },
  // Collection callbacks carry arbitrary per-collection field values on top of the listed params, so their param set
  // is OPEN (strictParams:false) — extra keys are the record's fields, not mistakes.
  addCollectionRecord: {
    source: 'collection',
    title: 'Add Collection Record',
    strictParams: false,
    params: {
      collectionId: { type: 'select', description: 'The collection to add the record to.' },
      recordStatus: {
        type: 'select',
        description: 'Status of the new record.',
        default: 'draft',
        options: ['published', 'draft', 'archived', 'deleted', 'created']
      }
    }
  },
  updateCollectionRecord: {
    source: 'collection',
    title: 'Update Collection Record',
    strictParams: false,
    params: {
      collectionId: { type: 'select', description: 'The collection the record belongs to.' },
      recordId: { type: 'select', description: 'The record to update.' },
      recordStatus: {
        type: 'select',
        description: 'New status for the record.',
        default: 'draft',
        options: ['published', 'draft', 'archived', 'deleted', 'created']
      }
    }
  },
  removeCollectionRecord: {
    source: 'collection',
    title: 'Remove Collection Record',
    strictParams: false,
    params: {
      collectionId: { type: 'select', description: 'The collection the record belongs to.' },
      recordId: { type: 'select', description: 'The record to remove.' }
    }
  }
};

/** The built-in globalCallback for an action, or undefined when the action is not a known built-in (a plugin
 *  callback whose source/schema is not knowable here). */
export const getGlobalCallback = (action: string): BuiltinGlobalCallback | undefined =>
  Object.hasOwn(BUILTIN_GLOBAL_CALLBACKS, action) ? BUILTIN_GLOBAL_CALLBACKS[action] : undefined;

/** Report the param keys the agent supplied that are not valid for a built-in callback: only for CLOSED
 *  (`strictParams`) callbacks; open ones (collection) accept arbitrary field keys so nothing is unknown. Returns []
 *  for an unknown action (a plugin callback whose schema is not known here). */
export const unknownBuiltinParams = (action: string, params: Record<string, unknown>): string[] => {
  if (!(action in BUILTIN_GLOBAL_CALLBACKS)) {
    return [];
  }

  const builtin = BUILTIN_GLOBAL_CALLBACKS[action];
  if (!builtin.strictParams) {
    return [];
  }

  return unknownParams(params, builtin.params);
};

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
