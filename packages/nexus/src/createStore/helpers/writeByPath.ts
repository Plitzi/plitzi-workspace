// Immutable structural-sharing writer for multi-segment paths. A per-path compiled writer (`new Function`) emits
// literal-key spreads V8 clones on its fast path; a recursive fallback covers environments where a strict CSP
// blocks `new Function`. The codegen is injection-safe by construction — see `access`/`literalKey`.
//
// Auto-detection: after the first write to any given root object, subsequent writes to that object use
// `Object.create` (lazy clone) at every depth level, deferring the flat-object copy until `materialize()`.
// This makes burst writes to large objects O(1) per level instead of O(keys), while the codegen first write
// keeps deeply nested small-object paths (the "nested" benchmark) fast via inline spreads.

export const UNCHANGED: unique symbol = Symbol('unchanged');

type CompiledWriter = (root: unknown, value: unknown, isFn: boolean) => Record<string, unknown> | null;

// Creates a shallow lazy clone: the result has `key` as own property and inherits everything else from `base`. The
// caller must `materialize()` the result before handing it to user code that expects a plain object.
const lazyProp = (base: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> => {
  const obj = Object.create(base) as Record<string, unknown>;
  obj[key] = value;

  return obj;
};

// Recursively flattens a lazy prototype chain into a plain object. For plain objects (Object.prototype proto),
// primitives, and arrays, returns the input as-is — no allocation. Only flattens when the object has a non-standard
// prototype (lazy chain). Nested values are also recursively materialized so that any part of the materialized tree
// is compatible with `Object.keys()` and `toEqual`.
export const materialize = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }

  const proto = Object.getPrototypeOf(value) as object | null;
  if (proto === Object.prototype || proto === null) {
    return value;
  }

  const result: Record<string, unknown> = {};
  let current: object | null = value;
  while (current && current !== Object.prototype) {
    const keys = Object.keys(current);
    for (let i = 0, len = keys.length; i < len; i++) {
      const key = keys[i];
      if (!(key in result)) {
        result[key] = materialize((current as Record<string, unknown>)[key]);
      }
    }

    current = Object.getPrototypeOf(current) as object | null;
  }

  return result as unknown as T;
};

// Iterative lazy-prop writer. Replaces the recursiveStep / codegen for tracked objects: walks the segments once
// to collect base references, then builds the result back up with `Object.create` at every level (no spreads).
// This avoids function-call overhead (no recursion) and makes every level O(1).
const writeRecursive = (
  root: unknown,
  segments: readonly string[],
  value: unknown,
  isFn: boolean
): Record<string, unknown> | typeof UNCHANGED => {
  const len = segments.length;
  const bases: unknown[] = new Array(len);

  let current: unknown = root;
  for (let i = 0; i < len; i++) {
    bases[i] = current;
    current =
      typeof current === 'object' && current !== null ? (current as Record<string, unknown>)[segments[i]] : undefined;
  }

  const prevLeaf = current;
  const resolved = isFn ? (value as (p: unknown) => unknown)(prevLeaf) : value;
  if (prevLeaf === resolved) {
    return UNCHANGED;
  }

  let child = resolved;
  for (let i = len - 1; i >= 0; i--) {
    const raw = bases[i];
    if (Array.isArray(raw)) {
      const next = raw.slice();
      next[segments[i] as unknown as number] = child;
      child = next;
    } else {
      const base = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

      child = lazyProp(base, segments[i], child);
    }
  }

  return child as Record<string, unknown>;
};

// Numeric segments address array indices; codegen, which spreads into an object literal, can't preserve array-ness
// (the recursive writer can, and does, because it uses `Object.create` which keeps the base's type).
const isIndexSegment = (segment: string): boolean => /^\d+$/.test(segment);

// Identifier segments become literal `.prop` access / bare keys; anything else is `JSON.stringify`-ed into an inert
// string literal, so a hostile segment can never become executable code.
const IDENT_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const access = (segment: string): string => (IDENT_RE.test(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`);
const literalKey = (segment: string): string => (IDENT_RE.test(segment) ? segment : JSON.stringify(segment));

const compile = (segments: readonly string[]): CompiledWriter => {
  const len = segments.length;
  let body = '';

  for (let i = 0; i < len - 1; i++) {
    const parent = i === 0 ? 'o' : `_${i - 1}`;
    body += `var _${i}=${parent}==null?void 0:${parent}${access(segments[i])};\n`;
  }

  const leafParent = len > 1 ? `_${len - 2}` : 'o';
  body += `var _p=${leafParent}==null?void 0:${leafParent}${access(segments[len - 1])};\n`;
  body += 'var _v=f?v(_p):v;\nif(_p===_v)return null;\n';

  let expr = '_v';
  for (let i = len - 1; i >= 0; i--) {
    const container = i === 0 ? 'o' : `(_${i - 1}||{})`;
    expr = `{...${container},${literalKey(segments[i])}:${expr}}`;
  }
  body += `return ${expr};`;

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('o', 'v', 'f', body) as CompiledWriter;
};

let codegenAvailable: boolean | undefined;
let codegenForced: boolean | undefined;
const isCodegenAvailable = (): boolean => {
  if (codegenForced !== undefined) {
    return codegenForced;
  }

  if (codegenAvailable === undefined) {
    try {
      compile(['x', 'y'])({ x: {} }, 1, false);
      codegenAvailable = true;
    } catch {
      codegenAvailable = false;
    }
  }

  return codegenAvailable;
};

/**
 * Force the codegen path on/off.
 *
 * - `undefined` (default) — auto-detection: probes `new Function` at first use; if CSP blocks it, falls back
 *   to the recursive writer automatically.
 * - `false` — skip auto-detection and go directly to the recursive fallback (no `new Function`).
 * - `true` — force codegen even if the probe fails (useful for testing).
 */
export const setCodegenEnabled = (enabled: boolean | undefined): void => {
  codegenForced = enabled;
};

const cache = new Map<string, CompiledWriter>();
const MAX_CACHED = 256;

const getCompiled = (path: string, segments: readonly string[]): CompiledWriter | undefined => {
  if (!isCodegenAvailable()) {
    return undefined;
  }

  // Cache hit first: a compiled (and therefore array-free) path skips the per-segment scan below entirely.
  const cached = cache.get(path);
  if (cached) {
    return cached;
  }

  // The codegen spreads each container into an object literal, which would turn an array into a plain object. Paths
  // with a numeric segment touch an array, so fall back to the array-preserving recursive writer (never cached).
  if (segments.some(isIndexSegment)) {
    return undefined;
  }

  const fn = compile(segments);
  if (cache.size >= MAX_CACHED) {
    cache.delete(cache.keys().next().value as string);
  }
  cache.set(path, fn);

  return fn;
};

// Writes `value` (or `value(prevLeaf)` when `isFn`) at `path` immutably, sharing untouched subtrees. Returns the
// new root, or `UNCHANGED` when the leaf value is identical.
export const writeByPath = (
  root: unknown,
  path: string,
  segments: readonly string[],
  value: unknown,
  isFn: boolean
): Record<string, unknown> | typeof UNCHANGED => {
  const compiled = getCompiled(path, segments);
  if (compiled) {
    const next = compiled(root, value, isFn);

    return next === null ? UNCHANGED : next;
  }

  return writeRecursive(root, segments, value, isFn);
};

// Iterative lazy-prop writer, exported for store-level auto-detection (createSetState uses it after the first
// codegen write to the same root, turning subsequent writes into O(1) Object.create per level).
export { writeRecursive };
