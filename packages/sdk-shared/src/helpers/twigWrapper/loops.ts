import { applyConditionals } from './conditionals';
import { evalOperand } from './evalOperand';
import { BREAK_TAG, CONTINUE_TAG, FOR_OPEN, FOR_TAG, RANGE_EXPR } from './patterns';
import { renderTokens } from './renderTokens';

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

// Resolves a `{% for %}` collection expression. Supports:
// - Range syntax: `0..10`, `start..end` (numeric literals or variable paths)
// - Array/object variables resolved from the context
// Returns null when the expression cannot be resolved to an iterable.
const resolveCollection = (expr: string, context: Record<string, unknown>): unknown[] | null => {
  const range = RANGE_EXPR.exec(expr.trim());
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

  const value = evalOperand(expr, context);
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

// Processes the body of a single loop iteration: nested loops → conditionals → loop control → tokens.
// When a break or continue tag is found after resolving conditionals, the text BEFORE the tag is rendered
// and prepended to the sentinel, so renderForBlock can include it in the output before acting on the control flow.
const processBody = (body: string, context: Record<string, unknown>): string => {
  const afterLoops = applyLoops(body, context);
  const afterConditionals = applyConditionals(afterLoops, context);

  const breakMatch = BREAK_TAG.exec(afterConditionals);
  if (breakMatch) {
    const prefix = afterConditionals.slice(0, breakMatch.index);
    const rendered = renderTokens(prefix, context, false, false);
    return rendered + BREAK_SENTINEL;
  }

  const continueMatch = CONTINUE_TAG.exec(afterConditionals);
  if (continueMatch) {
    const prefix = afterConditionals.slice(0, continueMatch.index);
    const rendered = renderTokens(prefix, context, false, false);
    return rendered + CONTINUE_SENTINEL;
  }

  return renderTokens(afterConditionals, context, false, false);
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
  const tagRegex = new RegExp(FOR_TAG.source, 'g');
  tagRegex.lastIndex = openEnd;

  let elseIdx = -1;
  let elseLen = 0;
  let endIdx = -1;
  let endLen = 0;

  while (depth > 0) {
    const tag = tagRegex.exec(template);
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
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      const meta = buildLoopMeta(i, entries.length);
      const loopCtx = { ...context, [varName]: key, [secondVar]: value, loop: meta };
      const rendered = processBody(body, loopCtx);
      const control = pushAndControl(parts, rendered);
      if (control === 'break') {
        break;
      }
      if (control === 'continue') {
        continue;
      }
    }
    return parts.join('');
  }

  const collection = resolveCollection(collectionExpr, context);
  if (!collection || collection.length === 0) {
    return elseBody !== undefined ? processBody(elseBody, context) : '';
  }
  const parts: string[] = [];
  for (let i = 0; i < collection.length; i++) {
    const meta = buildLoopMeta(i, collection.length);
    const loopCtx = { ...context, [varName]: collection[i], loop: meta };
    const rendered = processBody(body, loopCtx);
    const control = pushAndControl(parts, rendered);
    if (control === 'break') {
      break;
    }
    if (control === 'continue') {
      continue;
    }
  }
  return parts.join('');
};

// Resolves every `{% for %}` block in the template, outermost first. Processing outermost blocks first ensures
// that loop variables from parent loops are available in the context when inner loops are resolved. The guard
// caps pathological input; a malformed block that never matches is left in place.
export const applyLoops = (template: string, context: Record<string, unknown>): string => {
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
