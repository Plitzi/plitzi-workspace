import { resolvePath } from './resolvePath';
import { STRING_LITERAL } from '../patterns/patterns';

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

  return resolvePath(context, token);
};
