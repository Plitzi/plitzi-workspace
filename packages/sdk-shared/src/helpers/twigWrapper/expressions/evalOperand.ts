/* eslint-disable quotes */
import { resolvePath } from './resolvePath';
import { STRING_LITERAL } from '../patterns/patterns';

// Splits an expression on the `~` concatenation operator, respecting quoted strings so that a
// tilde inside `"hello~world"` is not treated as an operator boundary.
const splitOnTilde = (expr: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];

    if (inQuote) {
      if (c === inQuote) {
        inQuote = null;
      }
      current += c;
    } else if (c === '"' || c === "'") {
      inQuote = c;
      current += c;
    } else if (c === '~') {
      parts.push(current);
      current = '';
    } else {
      current += c;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
};

// Converts a resolved operand to a string for concatenation. Booleans become "1"/"0", null/undefined
// become "", and objects get JSON-stringified.
const operandToString = (val: unknown): string => {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'boolean') {
    return val ? '1' : '0';
  }
  if (typeof val === 'number' || typeof val === 'string') {
    return String(val);
  }
  return JSON.stringify(val);
};

// Evaluates a bare expression — a token default, a filter argument or an `{% if %}` operand — into a value: a
// quoted string, a number, a boolean, or a path read out of the context.
export const evalOperand = (raw: string, context: Record<string, unknown>): unknown => {
  const token = raw.trim();
  const literal = STRING_LITERAL.exec(token);
  if (literal) {
    return literal[2];
  }

  if (token === 'true' || token === 'false') {
    return token === 'true';
  }

  if (token !== '' && !Number.isNaN(Number(token))) {
    return Number(token);
  }

  // Support the `~` string-concatenation operator: split into operands, evaluate each recursively,
  // and join the results as strings. This enables expressions like `name ~ " (" ~ count ~ ")"`.
  const parts = splitOnTilde(token);
  if (parts.length > 1) {
    return parts.map(p => operandToString(evalOperand(p, context))).join('');
  }

  return resolvePath(context, token);
};
