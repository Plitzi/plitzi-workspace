// `@uiw/react-json-view` has no renderer for function values: it prints the key and then nothing, so a callback kept in
// the store reads as an empty row. Functions are swapped for a tagged string that `renderFunctionValue` paints as a
// function chip; subtrees without functions keep their reference so the viewer's diffing/highlighting still holds. The
// NUL prefix keeps the tag apart from any real string the store may hold.
const FUNCTION_TAG = '\u0000fn:';

export const readFunctionLabel = (value: string): string =>
  value.startsWith(FUNCTION_TAG) ? value.slice(FUNCTION_TAG.length) : '';

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

const mapValue = (value: unknown): unknown => {
  if (typeof value === 'function') {
    return `${FUNCTION_TAG}ƒ ${value.name || 'anonymous'}()`;
  }

  if (isArray(value)) {
    const mapped = value.map(mapValue);

    return mapped.every((item, index) => item === value[index]) ? value : mapped;
  }

  if (!isRecord(value)) {
    return value;
  }

  const mapped: Record<string, unknown> = {};
  let changed = false;
  for (const [key, item] of Object.entries(value)) {
    mapped[key] = mapValue(item);
    changed ||= mapped[key] !== item;
  }

  return changed ? mapped : value;
};

const mapFunctionValues = (state?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!state) {
    return undefined;
  }

  const mapped = mapValue(state);

  // `mapValue` keeps a record a record; the guard only carries that fact through its `unknown` return type.
  return isRecord(mapped) ? mapped : state;
};

export default mapFunctionValues;
