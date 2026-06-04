// Immutable structural-sharing writer for multi-segment paths. Two implementations behind one entry point: a
// per-path compiled writer (`new Function`) that emits literal-key spreads V8 clones on its fast path, and a
// recursive fallback for when `new Function` is blocked (a CSP without `unsafe-eval`). The codegen is injection-safe
// by construction — see `access`/`literalKey`.

export const UNCHANGED: unique symbol = Symbol('unchanged');

// The resolved leaf value is parked here so callers read it without a per-write wrapper allocation; read
// synchronously after the write, before any notification runs.
export const writeResult: { resolved: unknown } = { resolved: undefined };

type CompiledWriter = (
  root: unknown,
  value: unknown,
  isFn: boolean,
  result: { resolved: unknown }
) => Record<string, unknown> | null;

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

    writeResult.resolved = resolved;

    // A plain spread + assignment clones faster than `{ ...base, [key]: resolved }`: a computed key inside an
    // object literal forces V8 off its fast object-clone path.
    const next = { ...base };
    next[key] = resolved;

    return next;
  }

  const child = recursiveStep(base[key], segments, index + 1, value, isFn);
  if (child === UNCHANGED) {
    return UNCHANGED;
  }

  const next = { ...base };
  next[key] = child;

  return next;
};

// Identifier segments become literal `.prop` access / bare object keys; anything else is `JSON.stringify`-ed into an
// inert string literal, so a hostile segment like `"]; doEvil(); //` can never become executable code.
const IDENT_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const access = (segment: string): string => (IDENT_RE.test(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`);
const literalKey = (segment: string): string => (IDENT_RE.test(segment) ? segment : JSON.stringify(segment));

const compile = (segments: readonly string[]): CompiledWriter => {
  const len = segments.length;
  let body = '';

  // Walk down to the leaf's parent, capturing each node (nullish-safe).
  for (let i = 0; i < len - 1; i++) {
    const parent = i === 0 ? 'o' : `_${i - 1}`;
    body += `var _${i}=${parent}==null?void 0:${parent}${access(segments[i])};\n`;
  }

  // Read the previous leaf, resolve the new value, bail if unchanged.
  const leafParent = len > 1 ? `_${len - 2}` : 'o';
  body += `var _p=${leafParent}==null?void 0:${leafParent}${access(segments[len - 1])};\n`;
  body += 'var _v=f?v(_p):v;\nif(_p===_v)return null;\nr.resolved=_v;\n';

  // Rebuild only the touched spine with literal-key spreads.
  let expr = '_v';
  for (let i = len - 1; i >= 0; i--) {
    const container = i === 0 ? 'o' : `(_${i - 1}||{})`;
    expr = `{...${container},${literalKey(segments[i])}:${expr}}`;
  }
  body += `return ${expr};`;

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('o', 'v', 'f', 'r', body) as CompiledWriter;
};

let codegenAvailable: boolean | undefined;
let codegenForced: boolean | undefined;
const isCodegenAvailable = (): boolean => {
  if (codegenForced !== undefined) {
    return codegenForced;
  }

  if (codegenAvailable === undefined) {
    try {
      // Probe once: a strict CSP without `unsafe-eval` makes this throw, and we fall back forever after.
      compile(['x', 'y'])({ x: {} }, 1, false, { resolved: undefined });
      codegenAvailable = true;
    } catch {
      codegenAvailable = false;
    }
  }

  return codegenAvailable;
};

// Test-only: force the codegen path on/off (pass `undefined` to restore probing) so the recursive fallback that a
// strict CSP would trigger can be exercised without an actual CSP.
export const __setCodegenEnabled = (enabled: boolean | undefined): void => {
  codegenForced = enabled;
};

const cache = new Map<string, CompiledWriter>();
const MAX_CACHED = 256;

const getCompiled = (path: string, segments: readonly string[]): CompiledWriter | undefined => {
  if (!isCodegenAvailable()) {
    return undefined;
  }

  let fn = cache.get(path);
  if (fn) {
    return fn;
  }

  fn = compile(segments);
  if (cache.size >= MAX_CACHED) {
    cache.delete(cache.keys().next().value as string);
  }
  cache.set(path, fn);

  return fn;
};

// Writes `value` (or `value(prevLeaf)` when `isFn`) at `path` immutably, sharing untouched subtrees. Returns the
// new root, or `UNCHANGED` when the leaf value is identical. The resolved leaf value is left in `writeResult`.
export const writeByPath = (
  root: unknown,
  path: string,
  segments: readonly string[],
  value: unknown,
  isFn: boolean
): Record<string, unknown> | typeof UNCHANGED => {
  const compiled = getCompiled(path, segments);
  if (compiled) {
    const next = compiled(root, value, isFn, writeResult);

    return next === null ? UNCHANGED : next;
  }

  return recursiveStep(root, segments, 0, value, isFn);
};
