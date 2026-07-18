// The SDK's built-in interaction sources register their `globalCallback` actions under a fixed module id, NOT under
// the element that hosts the flow: the runtime resolves a global callback as `callbacksAvailables[elementId][action]`
// (see sdk-interactions/InteractionsHelper), and these callbacks live on the source module — `space`, `state`,
// `navigation`, `auth`, `collection`. A node that stored the host element's idRef here would resolve to nothing and
// the flow would silently do nothing. SSR has no runtime handle on these React sources, so this catalog is a
// faithful, hand-maintained mirror of what each source declares (source id + the param defaults the builder
// pre-fills). Mirror any change to the sdk-interactions sources here.

export interface BuiltinParamDefault {
  value: string | number | boolean;
  // Only fill when this predicate over the already-resolved params holds — mirrors the source param's `when`, so a
  // conditionally-shown field (e.g. autoDismissTimeout only when autoDismiss is on) is not filled when hidden.
  when?: (params: Record<string, unknown>) => boolean;
}

export interface BuiltinGlobalCallback {
  // The registration id the runtime looks the callback up under — the value a node's `elementId` must carry.
  source: string;
  title: string;
  // Default values the builder pre-fills for the callback's params; merged into params the agent omits.
  defaults: Record<string, BuiltinParamDefault>;
}

export const BUILTIN_GLOBAL_CALLBACKS: Record<string, BuiltinGlobalCallback> = {
  addNotification: {
    source: 'space',
    title: 'Add Notification',
    defaults: {
      content: { value: 'Content' },
      placement: { value: 'top-right' },
      appeareance: { value: 'success' },
      autoDismiss: { value: true },
      autoDismissTimeout: { value: 5000, when: params => params.autoDismiss === true }
    }
  },
  setState: { source: 'state', title: 'Set State', defaults: { key: { value: '' } } },
  clearState: { source: 'state', title: 'Clear State', defaults: {} },
  navigate: { source: 'navigation', title: 'Navigate', defaults: {} },
  authLogin: { source: 'auth', title: 'Auth Login', defaults: {} },
  authLogout: { source: 'auth', title: 'Auth Logout', defaults: {} },
  authRefreshDetails: { source: 'auth', title: 'Auth Refresh Details', defaults: {} },
  addCollectionRecord: {
    source: 'collection',
    title: 'Add Collection Record',
    defaults: { recordStatus: { value: 'draft' } }
  },
  updateCollectionRecord: {
    source: 'collection',
    title: 'Update Collection Record',
    defaults: { recordStatus: { value: 'draft' } }
  },
  removeCollectionRecord: { source: 'collection', title: 'Remove Collection Record', defaults: {} }
};

/** Resolve a `globalCallback` action against the built-in catalog: returns the module id it is registered under
 *  (`source`) and the params with any missing defaults filled. An action the catalog does not know (e.g. a plugin
 *  callback) yields no source and unchanged params, so the caller keeps its own behavior for it. */
export const applyBuiltinCallback = (
  action: string,
  params: Record<string, unknown>
): { source?: string; params: Record<string, unknown> } => {
  if (!(action in BUILTIN_GLOBAL_CALLBACKS)) {
    return { params };
  }

  const builtin = BUILTIN_GLOBAL_CALLBACKS[action];
  const next: Record<string, unknown> = { ...params };
  for (const [key, def] of Object.entries(builtin.defaults)) {
    if (next[key] !== undefined || (def.when && !def.when(next))) {
      continue;
    }

    next[key] = def.value;
  }

  return { source: builtin.source, params: next };
};
