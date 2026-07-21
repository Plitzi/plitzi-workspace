import { applyApplyTag } from './apply';
import { applyConditionals } from '../conditionals/conditionals';
import { evalOperand } from '../expressions/evalOperand';
import { applyLoops } from '../loops/loops';
import { SET_ASSIGN } from '../patterns/patterns';
import { renderTokens } from '../tokens/renderTokens';

// Processes the content of a `{% set %}` block through the template pipeline (loops → conditionals →
// tokens → apply) so that nested tags are evaluated before storing.
const processSetBlockContent = (content: string, context: Record<string, unknown>): string => {
  let processed = applySet(content, context);
  processed = applyLoops(processed, context);
  processed = applyConditionals(processed, context);
  processed = renderTokens(processed, context, false, false);
  processed = applyApplyTag(processed, context);
  return processed;
};

// Matches opening `{% set name %}` and closing `{% endset %}` for depth scanning.
const SET_OPEN = /\{%\s*set\s+(\w+)\s*%\}/g;
const SET_CLOSE = /\{%\s*endset\s*%\}/g;

// Processes `{% set %}` tags: evaluates the expression and stores the result in the context.
// Supports two forms:
//   `{% set variable = expression %}` — assigns the expression result
//   `{% set variable %}content{% endset %}` — captures block content (processed through the template pipeline)
// Nesting is handled inside-out using depth counting: the innermost complete pair is processed first,
// then the result feeds the outer pair.
export const applySet = (template: string, context: Record<string, unknown>): string => {
  let result = template;

  // Process `{% set variable = expression %}` — simple assignment
  SET_ASSIGN.lastIndex = 0;
  result = result.replace(SET_ASSIGN, (_full, name: string, expr: string) => {
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

    context[bestName] = processSetBlockContent(bestContent, context);
    result = result.slice(0, bestStart) + result.slice(bestEnd);
  }

  return result;
};
