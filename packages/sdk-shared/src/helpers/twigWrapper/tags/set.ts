import { applyApplyTag } from './apply';
import { applyConditionals } from '../conditionals/conditionals';
import { evalOperand } from '../expressions/evalOperand';
import { applyLoops } from '../loops/loops';
import { SET_ASSIGN, SET_BLOCK } from '../patterns/patterns';
import { renderTokens } from '../tokens/renderTokens';

// Processes `{% set %}` tags: evaluates the expression and stores the result in the context.
// Supports two forms:
//   `{% set variable = expression %}` — assigns the expression result
//   `{% set variable %}content{% endset %}` — captures block content (processed through the template pipeline)
// The variable is stored in the context and available to subsequent template processing.
export const applySet = (template: string, context: Record<string, unknown>): string => {
  let result = template;

  // Process `{% set variable = expression %}` — simple assignment
  SET_ASSIGN.lastIndex = 0;
  result = result.replace(SET_ASSIGN, (_full, name: string, expr: string) => {
    context[name] = evalOperand(expr, context);
    return '';
  });

  // Process `{% set variable %}content{% endset %}` — block capture.
  // The captured content is processed through the template pipeline (loops → conditionals → tokens → apply)
  // so that nested tags are evaluated before storing. Set is skipped to avoid recursive set processing.
  SET_BLOCK.lastIndex = 0;
  result = result.replace(SET_BLOCK, (_full, name: string, content: string) => {
    let processed = applyLoops(content, context);
    processed = applyConditionals(processed, context);
    processed = renderTokens(processed, context, false, false);
    processed = applyApplyTag(processed, context);
    context[name] = processed;
    return '';
  });

  return result;
};
