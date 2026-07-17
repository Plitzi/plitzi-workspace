import { evalOperand } from './evalOperand';
import { COMPARISON, IF_BLOCK } from './patterns';

// Compares two condition operands. `==`/`!=` are loose and twig-like (compared by string form, so `5 == '5'` and
// id juggling behave as before); the relational operators are numeric when both sides parse as numbers and
// lexicographic otherwise. An unknown operator can never reach here — COMPARISON only yields these six.
const compareValues = (operator: string, left: unknown, right: unknown): boolean => {
  if (operator === '==') {
    return String(left) === String(right);
  }

  if (operator === '!=') {
    return String(left) !== String(right);
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    if (operator === '>') {
      return leftNumber > rightNumber;
    }

    if (operator === '<') {
      return leftNumber < rightNumber;
    }

    return operator === '>=' ? leftNumber >= rightNumber : leftNumber <= rightNumber;
  }

  const leftText = String(left);
  const rightText = String(right);
  if (operator === '>') {
    return leftText > rightText;
  }

  if (operator === '<') {
    return leftText < rightText;
  }

  return operator === '>=' ? leftText >= rightText : leftText <= rightText;
};

// Evaluates a `{% if %}` condition. Anything it cannot make sense of — an unresolved path, an unsupported operator
// left inside the operand, a malformed expression — collapses to a falsy result rather than throwing.
const evalCondition = (expr: string, context: Record<string, unknown>): boolean => {
  const comparison = COMPARISON.exec(expr.trim());
  if (comparison) {
    return compareValues(comparison[2], evalOperand(comparison[1], context), evalOperand(comparison[3], context));
  }

  return Boolean(evalOperand(expr, context));
};

// Replaces every `{% if %}` block with its chosen branch, innermost first. The guard caps pathological input; a
// block that never matches (malformed) is simply left in place.
export const applyConditionals = (template: string, context: Record<string, unknown>): string => {
  let result = template;
  let guard = 0;
  while (guard < 1000 && IF_BLOCK.test(result)) {
    result = result.replace(IF_BLOCK, (_full, expr: string, thenPart: string, elsePart?: string) =>
      evalCondition(expr, context) ? thenPart : (elsePart ?? '')
    );
    guard += 1;
  }

  return result;
};
