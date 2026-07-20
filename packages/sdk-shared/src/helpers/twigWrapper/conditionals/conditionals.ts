import { evalOperand } from '../expressions/evalOperand';
import { COMPARISON, IF_BLOCK } from '../patterns/patterns';

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

// Splits an expression by a logical keyword (`and`/`or`) at word boundaries, respecting quoted strings.
// Returns a single-element array when the keyword is not present.
const splitByKeyword = (expr: string, keyword: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      }

      current += char;
      i++;
      continue;
    }

    if (char === '"' || char === "'") {
      inQuote = char;
      current += char;
      i++;
      continue;
    }

    // Check if the keyword starts at this position (word boundary + keyword + word boundary)
    const remaining = expr.slice(i);
    const re = new RegExp(`^(\\s+)${keyword}(\\s+|$)`, 'i');
    const kwMatch = re.exec(remaining);

    if (kwMatch) {
      const trimmed = current.trim();
      if (trimmed !== '') {
        parts.push(trimmed);
      }

      current = '';
      i += kwMatch[0].length;
      continue;
    }

    current += char;
    i++;
  }

  const trimmed = current.trim();
  if (trimmed !== '') {
    parts.push(trimmed);
  }

  return parts.length > 0 ? parts : [expr];
};

// Evaluates a `{% if %}` condition. Anything it cannot make sense of — an unresolved path, an unsupported operator
// left inside the operand, a malformed expression — collapses to a falsy result rather than throwing.
//
// Twig operator precedence: `not` (highest) > `and` > `or` (lowest).
const evalCondition = (expr: string, context: Record<string, unknown>): boolean => {
  const trimmed = expr.trim();

  // Twig `or` — lowest precedence: split by `or`, any truthy part makes the whole expression truthy.
  const orParts = splitByKeyword(trimmed, 'or');
  if (orParts.length > 1) {
    return orParts.some(part => evalCondition(part, context));
  }

  // Twig `and` — higher than `or`, lower than `not`: split by `and`, all parts must be truthy.
  const andParts = splitByKeyword(trimmed, 'and');
  if (andParts.length > 1) {
    return andParts.every(part => evalCondition(part, context));
  }

  // Twig `not` unary operator: `{% if not condition %}`
  if (trimmed.startsWith('not ')) {
    return !evalCondition(trimmed.slice(4), context);
  }

  const comparison = COMPARISON.exec(trimmed);
  if (comparison) {
    return compareValues(comparison[2], evalOperand(comparison[1], context), evalOperand(comparison[3], context));
  }

  return Boolean(evalOperand(trimmed, context));
};

// Resolves a `{% if %}...{% elseif %}...{% else %}...{% endif %}` chain. Called when the if condition was false
// and the block contains `{% elseif %}` sections. Parses the full matched block to extract each branch, evaluates
// conditions in order, and returns the body of the first truthy branch (or the else body, or empty string).
const SECTION_MARKER_RE = /\{%\s*elseif\s+((?:(?!%\})[\s\S])+?)\s*%\}|\{%\s*else\s*%\}/g;

const resolveElseifChain = (block: string, context: Record<string, unknown>): string => {
  // Strip {% if COND %} from the start
  const ifMatch = /^\{%\s*if\s+(?:(?!%\})[\s\S])+?\s*%\}/.exec(block);
  if (!ifMatch) {
    return block;
  }

  // Strip {% endif %} from the end
  const endifMatch = /\{%\s*endif\s*%\}$/.exec(block);
  if (!endifMatch) {
    return block;
  }

  const inner = block.slice(ifMatch[0].length, block.length - endifMatch[0].length);

  // Walk through the inner content collecting sections between markers. Each marker either carries a captured
  // elseif condition (group 1) or is an {% else %} marker (group 1 undefined).
  const sections: Array<{ condition: string | null; body: string }> = [];
  let cursor = 0;

  SECTION_MARKER_RE.lastIndex = 0;
  let match = SECTION_MARKER_RE.exec(inner);
  while (match !== null) {
    // Push the body before this marker
    sections.push({ condition: null, body: inner.slice(cursor, match.index) });
    cursor = match.index + match[0].length;

    // match[1] is set for {% elseif COND %}, undefined for {% else %}
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- regex alternation: group 1 is absent for {% else %}
    const cond: string | null = match[1] !== undefined ? match[1] : null;
    sections.push({ condition: cond, body: '' });

    match = SECTION_MARKER_RE.exec(inner);
  }

  // Trailing body after the last marker
  sections.push({ condition: null, body: inner.slice(cursor) });

  // sections alternates: [ifBody, marker, body, marker, body, ..., trailingBody]
  // Skip index 0 (the if body, already evaluated as false).
  // Markers at odd indices have condition=string (elseif) or condition=null (else).
  // Bodies at even indices follow their marker.
  for (let i = 1; i < sections.length; i += 2) {
    const marker = sections[i];

    // null condition means {% else %} — always truthy
    if (marker.condition === null) {
      return sections[i + 1]?.body ?? '';
    }

    if (evalCondition(marker.condition, context)) {
      return sections[i + 1]?.body ?? '';
    }
  }

  return '';
};

// Replaces every `{% if %}` block with its chosen branch, innermost first. The guard caps pathological input; a
// block that never matches (malformed) is simply left in place.
export const applyConditionals = (template: string, context: Record<string, unknown>): string => {
  let result = template;
  let guard = 0;
  while (guard < 1000 && IF_BLOCK.test(result)) {
    result = result.replace(IF_BLOCK, (full, expr: string, thenPart: string, elsePart?: string) => {
      if (evalCondition(expr, context)) {
        return thenPart;
      }

      // If the block contains {% elseif %}, resolve the chain by parsing all sections.
      if (SECTION_MARKER_RE.test(full)) {
        SECTION_MARKER_RE.lastIndex = 0;

        return resolveElseifChain(full, context);
      }

      return elsePart ?? '';
    });
    guard += 1;
  }

  return result;
};
