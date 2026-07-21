/* eslint-disable quotes */
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

// Evaluates a Twig `is` test: null, empty, iterable, defined, odd, even, divisible by(n).
const evalTest = (value: unknown, testName: string, context: Record<string, unknown>): boolean => {
  const name = testName.trim().toLowerCase();
  if (name === 'null' || name === 'none') {
    return value === undefined || value === null;
  }

  if (name === 'empty') {
    if (value === undefined || value === null || value === '') {
      return true;
    }
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return true;
    }
    return false;
  }

  if (name === 'iterable') {
    return Array.isArray(value);
  }

  if (name === 'defined') {
    return value !== undefined;
  }

  if (name === 'odd') {
    return typeof value === 'number' && Math.abs(value) % 2 === 1;
  }

  if (name === 'even') {
    return typeof value === 'number' && Math.abs(value) % 2 === 0;
  }

  const divMatch = /^divisible\s+by\s*\((.+)\)$/.exec(name);
  if (divMatch) {
    const divisor = Number(evalOperand(divMatch[1], context));
    if (divisor === 0) {
      return false;
    }
    return typeof value === 'number' && value % divisor === 0;
  }

  // Unknown test: fall through to falsy.
  return false;
};

// Splits an expression by a logical keyword (`and`/`or`) at word boundaries, respecting quoted strings.
// Returns a single-element array when the keyword is not present.
// Uses inline character matching instead of regex for zero per-character allocations.
const splitByKeyword = (expr: string, keyword: string): string[] => {
  // Fast path: if the keyword is not present at all, return the expression as-is.
  if (expr.indexOf(keyword) === -1) {
    return [expr];
  }

  const kwLen = keyword.length;
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

    // Inline keyword match: require whitespace before, keyword (case-insensitive), then whitespace or EOL after.
    let matched = false;
    if (i > 0 && /\s/.test(expr[i])) {
      const kwStart = i;
      // Skip whitespace.
      while (i < expr.length && /\s/.test(expr[i])) {
        i++;
      }

      // Check if the keyword follows.
      const candidate = expr.slice(i, i + kwLen).toLowerCase();
      if (candidate === keyword) {
        const afterKw = i + kwLen;
        if (afterKw >= expr.length || /\s/.test(expr[afterKw])) {
          const trimmed = current.trim();
          if (trimmed !== '') {
            parts.push(trimmed);
          }

          current = '';
          i = afterKw;
          matched = true;
        }
      }

      if (!matched) {
        // Not a keyword match — backtrack and include the whitespace.
        i = kwStart;
      }
    }

    if (!matched) {
      current += char;
      i++;
    }
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
// Additional operators: `~` (concat), `in`/`not in`, `is` (test).
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

  // Twig `not in` — membership test with negation. Must check before `not` to avoid splitting `not in`.
  // Fast path: skip regex when the keyword is absent.
  if (trimmed.indexOf(' not ') !== -1 || trimmed.indexOf(' in ') !== -1) {
    const notInMatch = /^(.+?)\s+not\s+in\s+(.+)$/.exec(trimmed);
    if (notInMatch) {
      const needle = evalOperand(notInMatch[1], context);
      const haystack = evalOperand(notInMatch[2], context);
      if (Array.isArray(haystack)) {
        return !haystack.includes(needle);
      }
      if (typeof haystack === 'string') {
        return !haystack.includes(String(needle));
      }
      return true;
    }

    // Twig `in` — membership test: `value in collection` or `value in string`.
    const inMatch = /^(.+?)\s+in\s+(.+)$/.exec(trimmed);
    if (inMatch) {
      const needle = evalOperand(inMatch[1], context);
      const haystack = evalOperand(inMatch[2], context);
      if (Array.isArray(haystack)) {
        return haystack.includes(needle);
      }
      if (typeof haystack === 'string') {
        return haystack.includes(String(needle));
      }
      return false;
    }
  }

  // Twig `not` unary operator: `{% if not condition %}`
  if (trimmed.startsWith('not ')) {
    return !evalCondition(trimmed.slice(4), context);
  }

  // Twig `is not` (negated test operator): `value is not null`, `value is not empty`, etc.
  // Must check before `is` to avoid matching `is not` as just `is`.
  // Fast path: skip regex when the keyword is absent.
  if (trimmed.indexOf(' is ') !== -1) {
    const isNotMatch = /^(.+?)\s+is\s+not\s+(.+)$/.exec(trimmed);
    if (isNotMatch) {
      const value = evalOperand(isNotMatch[1], context);
      return !evalTest(value, isNotMatch[2], context);
    }

    // Twig `is` (test operator): `value is null`, `value is empty`, `value is iterable`, etc.
    const isMatch = /^(.+?)\s+is\s+(.+)$/.exec(trimmed);
    if (isMatch) {
      const value = evalOperand(isMatch[1], context);
      return evalTest(value, isMatch[2], context);
    }
  }

  // Twig `~` (concatenation operator): `value ~ other` — joins both sides as strings, then returns as truthy.
  // Check for `~` not inside quotes.
  const tildeIdx = findTildeOperator(trimmed);
  if (tildeIdx !== -1) {
    const left = evalOperand(trimmed.slice(0, tildeIdx), context);
    const right = evalOperand(trimmed.slice(tildeIdx + 1), context);
    return Boolean(String(left) + String(right));
  }

  const comparison = COMPARISON.exec(trimmed);
  if (comparison) {
    return compareValues(comparison[2], evalOperand(comparison[1], context), evalOperand(comparison[3], context));
  }

  // Twig treats empty arrays and empty objects as falsy, unlike JavaScript where `Boolean([])` is true.
  const operand = evalOperand(trimmed, context);
  if (Array.isArray(operand) && operand.length === 0) {
    return false;
  }
  if (operand !== null && typeof operand === 'object' && Object.keys(operand).length === 0) {
    return false;
  }
  return Boolean(operand);
};

// Finds the index of a top-level `~` operator (not inside quotes).
const findTildeOperator = (expr: string): number => {
  let inQuote: string | null = null;
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      inQuote = char;
      continue;
    }
    if (char === '~') {
      return i;
    }
  }
  return -1;
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
  // Fast path: no `{% if %}` tags at all — skip the entire conditional expansion.
  if (template.indexOf('{%') === -1 || !IF_BLOCK.test(template)) {
    return template;
  }

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
