import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

/** A value written or bound as text, as the type of the default it stands for — or as it is when it says nothing else. */
const asTypeOf = (fallback: unknown, value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  if (typeof fallback === 'number') {
    const parsed = Number(value.trim());

    return value.trim() !== '' && Number.isFinite(parsed) ? parsed : value;
  }

  return typeof fallback === 'boolean' && (value === 'true' || value === 'false') ? value === 'true' : value;
};

/**
 * A plugin's attributes as the types its declaration's defaults are: a value bound from text — a state, a row, what a
 * channel said — arrives as the number or the flag its default is (`'112'` as 112, `'true'` as true), so the component
 * reads the type it declares and never writes `Number(…)`. Anything else, and every attribute it has no default for,
 * as it is.
 *
 * Only a plugin carries its declaration on the component this wraps (`Object.assign(Component, declaration)`); a
 * built-in element is handed its attributes untouched.
 */
export const declaredAttributes = (
  component: unknown,
  attributes: Record<string, unknown>
): Record<string, unknown> => {
  if (typeof component !== 'function' || !('content' in component) || !isRecord(component.content)) {
    return attributes;
  }

  const defaults = component.content.attributes;
  if (!isRecord(defaults)) {
    return attributes;
  }

  let changed = false;
  const read: Record<string, unknown> = { ...attributes };
  for (const [key, value] of Object.entries(attributes)) {
    const typed = asTypeOf(defaults[key], value);
    if (typed !== value) {
      read[key] = typed;
      changed = true;
    }
  }

  // The same object when nothing changed, so a memo keyed on it does not see a new one every render.
  return changed ? read : attributes;
};
