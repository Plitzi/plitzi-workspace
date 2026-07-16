// Immutable structural-sharing writer for multi-segment paths. A per-path compiled writer (`new Function`) emits
// literal-key spreads V8 clones on its fast path; a recursive fallback covers environments where a strict CSP
// blocks `new Function`. The codegen is injection-safe by construction — see `access`/`literalKey`.

export const UNCHANGED: unique symbol = Symbol('unchanged');

type CompiledWriter = (root: unknown, value: unknown, isFn: boolean) => Record<string, unknown> | null;

// Numeric segments address array indices; the recursive writer keeps an existing array an array (codegen, which
// spreads into an object literal, can't preserve that — see `getCompiled`).
const isIndexSegment = (segment: string): boolean => /^\d+$/.test(segment);

const clone = (base: Record<string, unknown>): Record<string, unknown> =>
  // A plain spread/slice + assignment clones faster than `{ ...base, [key]: v }`: a computed key in an object
  // literal forces V8 off its fast clone path.
  Array.isArray(base) ? (base.slice() as unknown as Record<string, unknown>) : { ...base };

const recursiveStep = (
  node: unknown,
  segments: readonly string[],
  index: number,
  value: unknown,
  isFn: boolean
): Record<string, unknown> | typeof UNCHANGED => {
  const key = segments[index];
  const base = typeof node === 'object' && node !== null ? (node as Record<string, unknown>) : {};

  if (index === segments.length - 1) {
    const prev = base[key];
    const resolved = isFn ? (value as (p: unknown) => unknown)(prev) : value;
    if (prev === resolved) {
      return UNCHANGED;
    }

    const next = clone(base);
    next[key] = resolved;

    return next;
  }

  const child = recursiveStep(base[key], segments, index + 1, value, isFn);
  if (child === UNCHANGED) {
    return UNCHANGED;
  }

  const next = clone(base);
  next[key] = child;

  return next;
};

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

  // SSR / Edge runtimes: `new Function` may be blocked by CSP and provides no
  // benefit since writes are one-shot per request. The recursive fallback is
  // already proven (browsers with CSP use it), so skip the probe entirely.
  if (typeof window === 'undefined') {
    return false;
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

// Removes the leaf key at `segments` immutably, sharing untouched subtrees. Returns the new root, or `UNCHANGED`
// when any container along the path is absent or the leaf key doesn't exist (nothing to remove). A numeric leaf
// segment on an array is spliced out (shifting later items) rather than left as a hole.
const deleteStep = (
  node: unknown,
  segments: readonly string[],
  index: number
): Record<string, unknown> | typeof UNCHANGED => {
  if (typeof node !== 'object' || node === null) {
    return UNCHANGED;
  }

  const base = node as Record<string, unknown>;
  const key = segments[index];
  if (!Object.hasOwn(base, key)) {
    return UNCHANGED;
  }

  if (index === segments.length - 1) {
    const next = clone(base);
    if (Array.isArray(next)) {
      next.splice(Number(key), 1);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete next[key];
    }

    return next;
  }

  const child = deleteStep(base[key], segments, index + 1);
  if (child === UNCHANGED) {
    return UNCHANGED;
  }

  const next = clone(base);
  next[key] = child;

  return next;
};

export const deleteByPath = (root: unknown, segments: readonly string[]): Record<string, unknown> | typeof UNCHANGED =>
  deleteStep(root, segments, 0);

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

  return recursiveStep(root, segments, 0, value, isFn);
};
