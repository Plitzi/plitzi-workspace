import { hasValidToken } from '../helpers/twigWrapper';

import type { InteractionParamType } from '../types';

// The shape a declared param has, and the rules for reconciling one against what somebody supplied.
//
// Four catalogs are written against it — global callbacks (sdk-interactions), element callbacks (sdk-elements),
// utilities and binding transformers — and each lives with the code it describes. This is what they share, so it
// sits in the package they all already depend on: an authoring helper filling a step's params, the builder drawing
// the control for one and an MCP tool validating one are doing the same arithmetic, and doing it three times is how
// the answers drift.
//
// Not in `@plitzi/sdk-authoring` with the rest of the authoring surface, and the reason is the dependency arrow: a
// React source registering its callbacks reads this AT RUNTIME, so the authoring package importing it is fine and
// the reverse would be a cycle.

// `scalar` is the polymorphic value type: the param legitimately holds a string, number OR boolean (e.g. a setState
// `value`, whose data type follows the target attribute — booleans are stored as real booleans, numbers as numbers).
// The others map to a single JS type — `text`/`textarea` → string, `boolean` → boolean, `number` → number, `select`
// → one of `options`. This drives value-type validation (see `invalidParams`), not just the builder widget.
export type BuiltinParamType = 'text' | 'textarea' | 'select' | 'boolean' | 'number' | 'scalar';

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

  // --- What the builder's editor needs on top of the above -----------------------------------------------------
  //
  // A declaration serves two readers: whatever is authoring or validating a step, and the panel a person fills in.
  // The second one needs prose the first has no use for, and it is written here rather than in the component so
  // that ONE declaration answers both. Everything in this group has a derivation — a label from the param name, an
  // option label from its value — and is only written down where the derived text would be worse.

  /** Overrides the label derived from the param name (`autoDismiss` → "Auto Dismiss"). */
  label?: string;
  /** Overrides the label derived from an option value (`top-right` → "Top Right"). */
  optionLabels?: Record<string, string>;
  /**
   * The control the editor shows, when it is not the obvious one for `type` — including the case where it depends
   * on what the author has already filled in (a value whose control follows the type they picked above it).
   */
  builderType?: InteractionParamType | ((params: Record<string, unknown>) => InteractionParamType);
  /** Whether the editor offers to bind this param to a data source. Bindable unless a param says otherwise. */
  canBind?: boolean;
}

export type ParamSpec = Record<string, BuiltinParam>;

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

/** A param the agent supplied whose VALUE does not match its declared type — a boolean given as the string "true",
 *  a number given as a string, a `select` value outside its options, a null placeholder left behind. `expected` is
 *  the declared type, `got` the JS typeof (or "null"), and `options` the allowed values for a `select`. */
export interface InvalidParam {
  key: string;
  expected: BuiltinParamType;
  got: string;
  options?: string[];
}

const isNumeric = (value: string): boolean => value.trim() !== '' && Number.isFinite(Number(value));

// A param value may be a data-binding token (`{{ list_food.item.count }}`) instead of a literal — the runtime
// resolves it to whatever the source yields, so its string form is NOT a type error even where the param expects a
// boolean/number/select. Skip the value-type check for it; the token grammar is owned by twigWrapper's
// `hasValidToken` (a malformed `{{ }}` reads as false there, so a genuinely broken value is still flagged).
const isBindingToken = (value: unknown): boolean => typeof value === 'string' && hasValidToken(value);

const matchesType = (value: unknown, param: BuiltinParam): boolean => {
  switch (param.type) {
    case 'boolean':
      // Booleans must be REAL booleans — the builder/mongo stores true/false, so the strings "true"/"false" are a
      // malformation (unlike the polymorphic `scalar` value param, which handles its own coercion).
      return typeof value === 'boolean';
    case 'number':
      // A number OR a numeric string: the builder legitimately stores numbers as strings ("1500") and the runtime
      // coerces them, so only a non-numeric value is wrong.
      return typeof value === 'number' || (typeof value === 'string' && isNumeric(value));
    case 'select':
      return typeof value === 'string' && (!param.options || param.options.includes(value));
    case 'scalar':
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    case 'text':
    case 'textarea':
      return typeof value === 'string';
    default:
      return true;
  }
};

/** Declared params the agent supplied whose value is the WRONG type for the catalog — the check that catches a
 *  malformed node the unknown/missing/hidden checks miss (a boolean stored as a string, a select value not in its
 *  options, a leftover `null`). Only params actually in play are checked: undefined values (the param is absent) and
 *  params hidden by their own `when` guard against the effective params are skipped, so this never fires on a param
 *  that is not really used. Callers gate this to CLOSED (strict) catalogs, whose types we own authoritatively. */
export const invalidParams = (
  provided: Record<string, unknown>,
  effective: Record<string, unknown>,
  spec: ParamSpec
): InvalidParam[] => {
  const invalid: InvalidParam[] = [];
  for (const [key, param] of Object.entries(spec)) {
    const value = provided[key];
    if (value === undefined || isBindingToken(value) || (param.when && !param.when(effective))) {
      continue;
    }

    if (!matchesType(value, param)) {
      invalid.push({
        key,
        expected: param.type,
        got: value === null ? 'null' : typeof value,
        ...(param.options ? { options: param.options } : {})
      });
    }
  }

  return invalid;
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
