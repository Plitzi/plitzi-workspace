// Shared vocabulary for the three interaction catalogs (built-in globalCallbacks, built-in element callbacks and
// built-in utilities). Each catalog is a hand-maintained mirror of what the sdk-interactions / sdk-elements sources
// declare in the builder — the SSR runtime has no manifest of these, so the shapes and the reconcile rules live in
// ONE place and every catalog validates/fills params the same way.

export type BuiltinParamType = 'text' | 'textarea' | 'select' | 'boolean' | 'number';

export interface BuiltinParam {
  type: BuiltinParamType;
  // What the param is for — shown to the agent so it uses the right key instead of inventing one.
  description: string;
  // Value the builder pre-fills when the agent omits the param. Absent means the param has no default (the agent
  // must supply it when relevant).
  default?: string | number | boolean;
  // Allowed values for a `select` param.
  options?: string[];
  // Only fill the default / show the param when this predicate over the already-resolved params holds — mirrors the
  // source param's `when`, so a conditionally-shown field (e.g. a value only shown once its category/type is set) is
  // not filled when hidden.
  when?: (params: Record<string, unknown>) => boolean;
  // A param the agent MUST supply for a well-formed node — omitting it makes the step malformed (e.g. a setState
  // with no `category`/`key`). Validation flags a missing required param (when its `when` guard holds), even if a
  // `default` also exists (the builder always writes it; a silent default could pick the wrong value).
  required?: boolean;
}

export type ParamSpec = Record<string, BuiltinParam>;

/** Keys the agent supplied that are not declared params — mistakes for a CLOSED (strict) param set, dropped on
 *  apply. Callers decide whether a set is strict; an open set never reports unknown keys. */
export const unknownParams = (params: Record<string, unknown>, spec: ParamSpec): string[] =>
  Object.keys(params).filter(key => !(key in spec));

/** Declared params the agent supplied that end up HIDDEN because their own `when` guard is false against the
 *  effective params — they are silently ignored (e.g. a global setState `value` with no `type`, or an
 *  addNotification `autoDismissTimeout` with autoDismiss:false). Evaluated against the effective params so a param
 *  the default fills in (e.g. category:"attribute") does not false-report a value as hidden. */
export const hiddenParams = (
  provided: Record<string, unknown>,
  effective: Record<string, unknown>,
  spec: ParamSpec
): string[] => {
  const hidden: string[] = [];
  for (const [key, param] of Object.entries(spec)) {
    if (param.when && provided[key] !== undefined && !param.when(effective)) {
      hidden.push(key);
    }
  }

  return hidden;
};

/** Declared params marked `required` that the agent did NOT supply, and whose `when` guard holds against the
 *  effective params (so they are actually in play). Evaluated against the effective params so a required param
 *  gated by a companion (e.g. setState `value`, shown only once `category` is set) is not reported when its guard
 *  is not met. */
export const missingRequiredParams = (
  provided: Record<string, unknown>,
  effective: Record<string, unknown>,
  spec: ParamSpec
): string[] => {
  const missing: string[] = [];
  for (const [key, param] of Object.entries(spec)) {
    if (param.required && provided[key] === undefined && (!param.when || param.when(effective))) {
      missing.push(key);
    }
  }

  return missing;
};

/** Reconcile supplied params to a catalog schema: drop unknown keys when the set is CLOSED (strict), then fill the
 *  builder's defaults for any declared param the agent omitted whose `when` guard holds. Mirrors what the builder
 *  stores, so the persisted node round-trips cleanly. */
export const reconcileParams = (
  params: Record<string, unknown>,
  spec: ParamSpec,
  strict: boolean
): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (strict && !(key in spec)) {
      continue;
    }

    next[key] = value;
  }

  for (const [key, param] of Object.entries(spec)) {
    if (param.default === undefined || next[key] !== undefined || (param.when && !param.when(next))) {
      continue;
    }

    next[key] = param.default;
  }

  return next;
};
