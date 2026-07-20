import { evalOperand } from '../expressions/evalOperand';
import { SET_ASSIGN, SET_BLOCK } from '../patterns/patterns';

// Processes `{% set %}` tags: evaluates the expression and stores the result in the context.
// Supports two forms:
//   `{% set variable = expression %}` — assigns the expression result
//   `{% set variable %}content{% endset %}` — captures block content
// The variable is stored in the context and available to subsequent template processing.
export const applySet = (template: string, context: Record<string, unknown>): string => {
  let result = template;

  // Process `{% set variable = expression %}` — simple assignment
  SET_ASSIGN.lastIndex = 0;
  result = result.replace(SET_ASSIGN, (_full, name: string, expr: string) => {
    context[name] = evalOperand(expr, context);
    return '';
  });

  // Process `{% set variable %}content{% endset %}` — block capture
  SET_BLOCK.lastIndex = 0;
  result = result.replace(SET_BLOCK, (_full, name: string, content: string) => {
    context[name] = content;
    return '';
  });

  return result;
};
