import type { InteractionCallback, InteractionCallbackParam } from '@plitzi/sdk-shared';

/** A declared param's type, as it reads now: a type that follows other params is asked with them. */
const typeOf = (param: InteractionCallbackParam, values: Record<string, unknown>): string =>
  typeof param.type === 'function' ? param.type(values) : param.type;

/** What a value written as text means for a param of `type`; `undefined` when it says nothing. */
const coerce = (type: string, value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  if (type === 'number') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return undefined;
    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : value;
  }

  if (type === 'boolean' && (value === 'true' || value === 'false')) {
    return value === 'true';
  }

  return value;
};

/**
 * A step's params, each as the type its callback DECLARES: a `number` param written `5000` — or bound to text that
 * says it — arrives as the number, a `boolean` one written `'true'` as `true`, an empty number as nothing at all (so the
 * component's default applies). Everything else arrives as written.
 *
 * The callback declares the type, so the conversion happens once, here, for every action — a plugin's above all, whose
 * author otherwise wrote `Number(params.interval)` in every callback. Only the step's own params: what the flow and
 * the page hand along beside them is theirs.
 */
export const coerceDeclaredParams = (
  // Absent for an action nothing registered with a declaration: its params go through as written.
  declared: InteractionCallback['params'] | undefined,
  params: Record<string, unknown>
): Record<string, unknown> => {
  if (!declared) {
    return params;
  }

  const declarations = typeof declared === 'function' ? declared(params) : declared;
  const coerced: Record<string, unknown> = { ...params };
  for (const [name, param] of Object.entries(declarations)) {
    if (Object.hasOwn(params, name)) {
      coerced[name] = coerce(typeOf(param, params), params[name]);
    }
  }

  return coerced;
};
