import { applyApplyTag } from './apply';
import { applyConditionals } from '../conditionals/conditionals';
import { evalOperand } from '../expressions/evalOperand';
import { applyLoops } from '../loops/loops';
import { SET_ASSIGN } from '../patterns/patterns';
import { renderTokens } from '../tokens/renderTokens';

// Processes the content of a `{% set %}` block through the template pipeline (loops → conditionals →
// tokens → apply) so that nested tags are evaluated before storing. Only runs steps that the content
// actually needs — a plain string skips the entire pipeline.
const processSetBlockContent = (content: string, context: Record<string, unknown>): string => {
  let processed = content;

  if (processed.indexOf('{%') !== -1 || processed.indexOf('{{') !== -1) {
    processed = applySet(processed, context);
    if (processed.indexOf('{%') !== -1) {
      processed = applyLoops(processed, context);
      processed = applyConditionals(processed, context);
    }

    if (processed.indexOf('{{') !== -1) {
      processed = renderTokens(processed, context, false, false);
    }

    if (processed.indexOf('{%') !== -1) {
      processed = applyApplyTag(processed, context);
    }
  }

  return processed;
};

// Matches opening `{% set name %}` and closing `{% endset %}` for depth scanning.
const SET_OPEN = /\{%\s*set\s+(\w+)\s*%\}/g;
const SET_CLOSE = /\{%\s*endset\s*%\}/g;

// Matches any structural tag used to track block depth: opening tags (for, if, apply) increment depth,
// closing tags (endfor, endif, endapply) decrement it. This keeps applySet from stripping set tags
// that live inside block bodies — those are processed later by the block's own body pipeline.
const BLOCK_TAG = /\{%\s*(for|if|apply|endfor|endif|endapply)\b[\s\S]*?%\}/g;

// Computes a set of character ranges that are inside block bodies (for, if, apply). A set tag
// falling inside any of these ranges is skipped by the top-level applySet — the block's own
// body pipeline will handle it when the block expands.
const computeBlockRanges = (template: string): Array<[number, number]> => {
  const ranges: Array<[number, number]> = [];
  const stack: Array<{ tag: string; start: number }> = [];

  BLOCK_TAG.lastIndex = 0;
  let match;
  while ((match = BLOCK_TAG.exec(template)) !== null) {
    const tag = match[1];
    const start = match.index;
    const end = start + match[0].length;

    if (tag === 'for' || tag === 'if' || tag === 'apply') {
      stack.push({ tag, start });
    } else {
      const open = stack.pop();
      if (open) {
        ranges.push([open.start, end]);
      }
    }
  }

  return ranges;
};

const isInsideBlock = (pos: number, ranges: Array<[number, number]>): boolean =>
  ranges.some(([start, end]) => pos >= start && pos < end);

// Processes `{% set %}` tags: evaluates the expression and stores the result in the context.
// Supports two forms:
//   `{% set variable = expression %}` — assigns the expression result
//   `{% set variable %}content{% endset %}` — captures block content (processed through the template pipeline)
// Nesting is handled inside-out using depth counting: the innermost complete pair is processed first,
// then the result feeds the outer pair.
export const applySet = (template: string, context: Record<string, unknown>): string => {
  let result = template;

  // Fast path: skip block range computation when no block tags exist (most common case).
  const hasBlockTags = template.indexOf('{%') !== -1;
  const blockRanges = hasBlockTags ? computeBlockRanges(template) : [];

  // Process `{% set variable = expression %}` — simple assignment.
  // Skip tags that fall inside a block body.
  SET_ASSIGN.lastIndex = 0;
  result = result.replace(SET_ASSIGN, (_full, name: string, expr: string, offset: number) => {
    if (blockRanges.length > 0 && isInsideBlock(offset, blockRanges)) {
      return _full;
    }

    context[name] = evalOperand(expr, context);
    return '';
  });

  // Process `{% set variable %}content{% endset %}` — block capture with proper nesting.
  // Scan for innermost set/endset pairs using depth counting, process them first.
  for (;;) {
    let bestStart = -1;
    let bestEnd = -1;
    let bestName = '';
    let bestContent = '';

    let i = 0;
    while (i < result.length) {
      SET_OPEN.lastIndex = i;
      const openMatch = SET_OPEN.exec(result);
      if (!openMatch) {
        break;
      }

      const openStart = openMatch.index;
      const openEnd = SET_OPEN.lastIndex;
      const varName = openMatch[1];

      // Find the matching {% endset %} by counting depth.
      let depth = 1;
      const contentStart = openEnd;
      let j = openEnd;
      let foundEnd = false;

      while (j < result.length) {
        SET_OPEN.lastIndex = j;
        SET_CLOSE.lastIndex = j;
        const nextOpen = SET_OPEN.exec(result);
        const nextClose = SET_CLOSE.exec(result);

        if (!nextClose) {
          break;
        }

        if (nextOpen && nextOpen.index < nextClose.index) {
          depth++;
          j = SET_OPEN.lastIndex;
        } else {
          depth--;
          if (depth === 0) {
            bestStart = openStart;
            bestEnd = SET_CLOSE.lastIndex;
            bestName = varName;
            bestContent = result.slice(contentStart, nextClose.index);
            foundEnd = true;
            break;
          }
          j = SET_CLOSE.lastIndex;
        }
      }

      if (foundEnd) {
        break;
      }

      i = openEnd;
    }

    if (bestStart === -1) {
      break;
    }

    // Skip set blocks that fall inside a for/if/apply body — they'll be processed when the block expands.
    if (blockRanges.length > 0 && isInsideBlock(bestStart, blockRanges)) {
      break;
    }

    context[bestName] = processSetBlockContent(bestContent, context);
    result = result.slice(0, bestStart) + result.slice(bestEnd);
  }

  return result;
};
