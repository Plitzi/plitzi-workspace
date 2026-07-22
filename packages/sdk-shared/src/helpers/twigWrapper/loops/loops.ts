import { applyConditionals } from '../conditionals/conditionals';
import { evalOperand } from '../expressions/evalOperand';
import { BREAK_TAG, CONTINUE_TAG, FOR_OPEN, FOR_TAG, IF_BLOCK, RANGE_EXPR } from '../patterns/patterns';
import { applySet } from '../tags/set';
import { renderTokens } from '../tokens/renderTokens';

type LoopMeta = {
  index: number;
  index0: number;
  first: boolean;
  last: boolean;
  length: number;
  revindex: number;
  revindex0: number;
};

const buildLoopMeta = (index: number, length: number): LoopMeta => ({
  index: index + 1,
  index0: index,
  first: index === 0,
  last: index === length - 1,
  length,
  revindex: length - index,
  revindex0: length - index - 1
});

// Fast path check: returns true when the expression is a simple identifier (no dots, no range, no parens).
const isSimpleIdentifier = (expr: string): boolean => {
  const len = expr.length;
  if (len === 0) {
    return false;
  }

  const first = expr.charCodeAt(0);
  if (!((first >= 97 && first <= 122) || (first >= 65 && first <= 90) || first === 95)) {
    return false;
  }

  for (let i = 1; i < len; i++) {
    const c = expr.charCodeAt(i);
    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95) {
      continue;
    }

    return false;
  }

  return true;
};

// Resolves a `{% for %}` collection expression. Supports:
// - Range syntax: `0..10`, `start..end` (numeric literals or variable paths)
// - Function calls: `range(start, end)` or `range(start, end, step)`
// - Array/object variables resolved from the context
// Returns null when the expression cannot be resolved to an iterable.
const resolveCollection = (expr: string, context: Record<string, unknown>): unknown[] | null => {
  const trimmed = expr.trim();

  // Fast path: simple identifier like `items` — skip all regex checks.
  if (isSimpleIdentifier(trimmed)) {
    const value = context[trimmed];
    if (Array.isArray(value)) {
      return value as unknown[];
    }

    if (value !== null && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>);
    }

    return null;
  }

  const range = RANGE_EXPR.exec(trimmed);
  if (range) {
    const startRaw = evalOperand(range[2], context);
    const endRaw = evalOperand(range[4], context);
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      const step = start <= end ? 1 : -1;
      const result: number[] = [];
      for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
        result.push(i);
      }
      return result;
    }
    return null;
  }

  // Support `range(end)`, `range(start, end)` and `range(start, end, step)` function calls
  // in collection expressions, matching the same logic as the token-level range() function.
  const rangeFuncMatch = RANGE_FUNC_RE.exec(trimmed);
  if (rangeFuncMatch) {
    const args = rangeFuncMatch[1].split(',').map(a => Number(evalOperand(a.trim(), context)));
    if (args.length >= 1 && args.every(a => !Number.isNaN(a))) {
      const start = args.length === 1 ? 0 : args[0];
      const end = args.length === 1 ? args[0] : args[1];
      const hasExplicitStep = args.length >= 3;
      const step = hasExplicitStep ? args[2] : start <= end ? 1 : -1;

      if (step === 0) {
        return [];
      }

      const result: number[] = [];
      if (step > 0) {
        for (let i = start; i <= end; i += step) {
          result.push(i);
        }
      } else {
        for (let i = start; i >= end; i += step) {
          result.push(i);
        }
      }
      return result;
    }
    return null;
  }

  const value = evalOperand(trimmed, context);
  if (Array.isArray(value)) {
    return value as unknown[];
  }

  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>);
  }

  return null;
};

// Resolves an object collection into [key, value] pairs for `{% for key, value in obj %}`.
const resolveObjectEntries = (expr: string, context: Record<string, unknown>): [string, unknown][] | null => {
  const value = evalOperand(expr, context);
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>);
  }
  return null;
};

// Sentinel values returned by processBody when it encounters {% break %} or {% continue %} after resolving
// conditionals. These are checked by renderForBlock to control loop flow.
const BREAK_SENTINEL = '\x00TWIG_BREAK\x00';
const CONTINUE_SENTINEL = '\x00TWIG_CONTINUE\x00';

// Pre-compiled regex for detecting `range(end)` / `range(start, end)` / `range(start, end, step)` in collection expressions.
const RANGE_FUNC_RE = /^\s*range\s*\((.+)\)\s*$/;

// Processes the body of a single loop iteration. When the body contains conditional blocks (if/elseif/else),
// set tags must be processed AFTER conditionals so that {% break %}/{% continue %} inside conditionals are
// detected before side effects execute. The pipeline is:
//
//   - No conditionals: set → loops → break check → tokens  (set runs eagerly)
//   - Has conditionals: loops → conditionals → set → break check → tokens  (set deferred)
//
// This ensures that {% set total = total ~ i %} after {% if i > 3 %}{% break %}{% endif %} does NOT
// execute when the break fires.
const processBody = (body: string, context: Record<string, unknown>): string => {
  // Fast path: if the body has no twig syntax at all, skip the entire pipeline.
  if (body.indexOf('{%') === -1 && body.indexOf('{{') === -1) {
    return body;
  }

  const hasConditionals = IF_BLOCK.test(body);
  IF_BLOCK.lastIndex = 0;

  if (!hasConditionals) {
    const afterSet = applySet(body, context);
    const afterLoops = applyLoops(afterSet, context);

    // Use indexOf for the common case (exact match), fall back to regex for whitespace variants.
    let breakIdx = afterLoops.indexOf('{% break %}');
    if (breakIdx === -1) {
      const breakMatch = BREAK_TAG.exec(afterLoops);
      if (breakMatch) {
        breakIdx = breakMatch.index;
      }
    }
    if (breakIdx !== -1) {
      const prefix = afterLoops.slice(0, breakIdx);
      return renderTokens(prefix, context, false, false) + BREAK_SENTINEL;
    }

    let continueIdx = afterLoops.indexOf('{% continue %}');
    if (continueIdx === -1) {
      const continueMatch = CONTINUE_TAG.exec(afterLoops);
      if (continueMatch) {
        continueIdx = continueMatch.index;
      }
    }
    if (continueIdx !== -1) {
      const prefix = afterLoops.slice(0, continueIdx);
      return renderTokens(prefix, context, false, false) + CONTINUE_SENTINEL;
    }

    return renderTokens(afterLoops, context, false, false);
  }

  const afterLoops = applyLoops(body, context);
  const afterConditionals = applyConditionals(afterLoops, context);

  let breakIdx = afterConditionals.indexOf('{% break %}');
  if (breakIdx === -1) {
    const breakMatch = BREAK_TAG.exec(afterConditionals);
    if (breakMatch) {
      breakIdx = breakMatch.index;
    }
  }
  if (breakIdx !== -1) {
    const prefix = afterConditionals.slice(0, breakIdx);
    const afterSet = applySet(prefix, context);
    return renderTokens(afterSet, context, false, false) + BREAK_SENTINEL;
  }

  let continueIdx = afterConditionals.indexOf('{% continue %}');
  if (continueIdx === -1) {
    const continueMatch = CONTINUE_TAG.exec(afterConditionals);
    if (continueMatch) {
      continueIdx = continueMatch.index;
    }
  }
  if (continueIdx !== -1) {
    const prefix = afterConditionals.slice(0, continueIdx);
    const afterSet = applySet(prefix, context);
    return renderTokens(afterSet, context, false, false) + CONTINUE_SENTINEL;
  }

  const afterSet = applySet(afterConditionals, context);
  return renderTokens(afterSet, context, false, false);
};

type ForBlock = {
  fullStart: number;
  fullEnd: number;
  varName: string;
  secondVar: string | undefined;
  collectionExpr: string;
  body: string;
  elseBody: string | undefined;
};

// Pre-compiled tag regex for scanning nesting depth inside for blocks.
const FOR_TAG_SCAN = new RegExp(FOR_TAG.source, 'g');

// Finds the outermost `{% for %}` block by tracking nesting depth. The first `{% for %}` tag found is
// guaranteed to be outermost — subsequent tags at greater depth are skipped until the matching `{% endfor %}`.
const findOuterForBlock = (template: string): ForBlock | null => {
  const openMatch = FOR_OPEN.exec(template);
  if (!openMatch) {
    return null;
  }

  const openStart = openMatch.index;
  const openEnd = openStart + openMatch[0].length;

  let depth = 1;
  let ifDepth = 0;
  FOR_TAG_SCAN.lastIndex = openEnd;

  let elseIdx = -1;
  let elseLen = 0;
  let endIdx = -1;
  let endLen = 0;

  while (depth > 0) {
    const tag = FOR_TAG_SCAN.exec(template);
    if (!tag) {
      return null;
    }

    if (tag[1] === 'endif') {
      ifDepth--;
    } else if (tag[1] === 'endfor') {
      depth--;
      if (depth === 0) {
        endIdx = tag.index;
        endLen = tag[0].length;
        break;
      }
    } else if (tag[1] === 'else' && depth === 1 && ifDepth === 0) {
      elseIdx = tag.index;
      elseLen = tag[0].length;
    } else if (tag[1].startsWith('for')) {
      depth++;
    } else if (tag[1].startsWith('if')) {
      ifDepth++;
    }
  }

  const body = elseIdx >= 0 ? template.slice(openEnd, elseIdx) : template.slice(openEnd, endIdx);
  const elseBody = elseIdx >= 0 ? template.slice(elseIdx + elseLen, endIdx) : undefined;

  return {
    fullStart: openStart,
    fullEnd: endIdx + endLen,
    varName: openMatch[1],
    secondVar: openMatch[2],
    collectionExpr: openMatch[3],
    body,
    elseBody
  };
};

const renderForBlock = (block: ForBlock, context: Record<string, unknown>): string => {
  const { varName, secondVar, collectionExpr, body, elseBody } = block;

  const pushAndControl = (parts: string[], rendered: string): 'break' | 'continue' | undefined => {
    if (rendered.endsWith(BREAK_SENTINEL)) {
      const prefix = rendered.slice(0, -BREAK_SENTINEL.length);
      if (prefix) {
        parts.push(prefix);
      }
      return 'break';
    }
    if (rendered.endsWith(CONTINUE_SENTINEL)) {
      const prefix = rendered.slice(0, -CONTINUE_SENTINEL.length);
      if (prefix) {
        parts.push(prefix);
      }
      return 'continue';
    }
    parts.push(rendered);
    return undefined;
  };

  if (secondVar) {
    const entries = resolveObjectEntries(collectionExpr, context);
    if (!entries || entries.length === 0) {
      return elseBody !== undefined ? processBody(elseBody, context) : '';
    }
    const parts: string[] = [];
    const prevVar = context[varName];
    const prevSecond = context[secondVar];
    const prevLoop = context.loop;
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      const meta = buildLoopMeta(i, entries.length);
      context[varName] = key;
      context[secondVar] = value;
      context.loop = meta;
      const rendered = processBody(body, context);
      const control = pushAndControl(parts, rendered);
      if (control === 'break') {
        break;
      }

      if (control === 'continue') {
        continue;
      }
    }
    context[varName] = prevVar;
    context[secondVar] = prevSecond;
    context.loop = prevLoop;
    return parts.join('');
  }

  const collection = resolveCollection(collectionExpr, context);
  if (!collection || collection.length === 0) {
    return elseBody !== undefined ? processBody(elseBody, context) : '';
  }
  const parts: string[] = [];
  const prevVar = context[varName];
  const prevLoop = context.loop;
  for (let i = 0; i < collection.length; i++) {
    const meta = buildLoopMeta(i, collection.length);
    context[varName] = collection[i];
    context.loop = meta;
    const rendered = processBody(body, context);
    const control = pushAndControl(parts, rendered);
    if (control === 'break') {
      break;
    }

    if (control === 'continue') {
      continue;
    }
  }
  context[varName] = prevVar;
  context.loop = prevLoop;
  return parts.join('');
};

// Resolves every `{% for %}` block in the template, outermost first. Processing outermost blocks first ensures
// that loop variables from parent loops are available in the context when inner loops are resolved. The guard
// caps pathological input; a malformed block that never matches is left in place.
export const applyLoops = (template: string, context: Record<string, unknown>): string => {
  // Fast path: no `{% for %}` tags at all — skip the entire loop expansion.
  if (template.indexOf('{%') === -1 || !FOR_OPEN.test(template)) {
    return template;
  }

  let result = template;
  let guard = 0;
  while (guard < 1000 && FOR_OPEN.test(result)) {
    const block = findOuterForBlock(result);
    if (!block) {
      break;
    }
    const rendered = renderForBlock(block, context);
    result = result.slice(0, block.fullStart) + rendered + result.slice(block.fullEnd);
    guard += 1;
  }
  return result;
};
