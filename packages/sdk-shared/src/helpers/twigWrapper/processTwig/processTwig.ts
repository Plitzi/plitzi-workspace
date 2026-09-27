import { evaluate, evaluateExpression } from '../Evaluator';
import { finalizeRaw, flattenContext, renderSimpleTokens } from './helpers';
import { getNodes, resolveTokens } from '../TemplateCache';

import type { Expression } from '../AST';

export const processTwig = (
  template: string,
  variables: Record<string, unknown> = {},
  keepEmptyTokens = false,
  asRaw = false
): unknown => {
  if (typeof template !== 'string') {
    return template;
  }

  try {
    if (template.indexOf('{%') === -1 && template.indexOf('{{') === -1) {
      return template;
    }

    const context = 'variables' in variables ? flattenContext(variables) : variables;
    const entry = resolveTokens(template);
    if (!entry) {
      return template;
    }

    // Fast path: no tags and every token a simple/dotted path — render straight from the cached tokens.
    if (!keepEmptyTokens && !entry.hasTags && entry.allSimpleOrDotted) {
      const output = renderSimpleTokens(entry, context);
      return asRaw ? finalizeRaw(output) : output;
    }

    const nodes = getNodes(entry, keepEmptyTokens);
    if (!nodes) {
      return template;
    }

    const { output, variables: updatedContext, hasSet } = evaluate(nodes, context, keepEmptyTokens);

    if (hasSet) {
      Object.assign(variables, updatedContext);
    }

    if (keepEmptyTokens && output === template) {
      return template;
    }

    return asRaw ? finalizeRaw(output) : output;
  } catch {
    return template;
  }
};

/** Text that opens a JSON object or array: what the author of a param meant as a document. */
const opensDocument = (text: string): boolean => {
  const trimmed = text.trimStart();

  return trimmed.startsWith('{') || trimmed.startsWith('[');
};

/**
 * A param the author wrote as a JSON document, rendered as one — every value printed inside a string literal escaped
 * for it — and answered as the document it makes; `undefined` when it does not make one, and it is text after all.
 */
const renderDocument = (template: string, variables: Record<string, unknown>): unknown => {
  const entry = resolveTokens(template);
  // A template of plain names keeps only the tree with its sources: the same nodes, for evaluating.
  const nodes = entry ? (entry.nodes ?? entry.nodesWithSource) : null;
  if (!nodes) {
    return undefined;
  }

  try {
    const context = 'variables' in variables ? flattenContext(variables) : variables;
    const { output, variables: updatedContext, hasSet } = evaluate(nodes, context, false, true);
    if (!opensDocument(output)) {
      return undefined;
    }

    const document: unknown = JSON.parse(output);
    if (hasSet) {
      Object.assign(variables, updatedContext);
    }

    return document;
  } catch {
    return undefined;
  }
};

/**
 * A template's VALUE, where it has one: `{{ rows|filter(r => r.open) }}` is the filtered array, `{{ count > 0 }}` a
 * boolean, `{{ total }}` the number it holds.
 *
 * A template that is one `{{ expression }}` and nothing else (surrounding whitespace aside) answers that expression's
 * value untouched. Anything with text around it, or tags, is text by nature and renders as {@link processTwig}.
 *
 * Unlike `processTwig`'s `asRaw`, nothing goes through JSON on the way: `0`, `false` and `null` come back as
 * themselves, and a string that looks like a number stays a string.
 */
export const processTwigValue = (template: string, variables: Record<string, unknown> = {}): unknown => {
  if (typeof template !== 'string') {
    return template;
  }

  const entry = resolveTokens(template);
  const nodes = entry ? (entry.nodes ?? entry.nodesWithSource) : null;
  const meaningful = nodes?.filter(node => node.type !== 'text' || node.value.trim() !== '');
  if (meaningful?.length !== 1 || meaningful[0].type !== 'variable') {
    return processTwig(template, variables);
  }

  try {
    const context = 'variables' in variables ? flattenContext(variables) : variables;

    return evaluateExpression(meaningful[0].expression, context);
  } catch {
    return template;
  }
};

/** The filters whose product is JSON text: a param that is nothing but one of them wants the value it encodes. */
const JSON_FILTERS = new Set(['json_encode', 'to_json', 'object_as_json']);

const encodesJson = (expression: Expression): boolean =>
  expression.type === 'filter' && JSON_FILTERS.has(expression.filters[expression.filters.length - 1]?.name ?? '');

/** Text that is a JSON object or array document, as that document; any other text as the text it is. */
const jsonDocument = (text: string): unknown => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return text;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return text;
  }
};

/**
 * A flow step's param — in the browser's flows and in a server action's — as the value the step is handed.
 *
 * A param that is one `{{ expression }}` is that expression's value, exactly: a string stays a string however it
 * looks. The type is the VALUE's, never guessed from its text — which is what the step params used to do, rendering
 * the value to text and reading the text back as JSON: a password typed as `1234` reached the server as a number, and
 * a text field declared `text` on the far side then saw no password at all. What a param should be converted to is
 * the business of whoever declares its type — `setState`'s `type`, an action's input fields — not of the resolver.
 *
 * Two readings of JSON stay, because in both the author wrote JSON on purpose: a param that is nothing but a JSON
 * filter (`{{ saved|json_encode }}`) is the value it encodes, and text around the tokens that makes a JSON object or
 * array (`{ "id": "{{ id }}" }`, an `input` written as a document) is that document. A value printed inside one of
 * the document's string literals is escaped for it: a visitor's `Say "hi"` or a note on two lines used to break the
 * document, and the step was handed its raw text instead. Any other text is text. A value that is not there reads as
 * an empty string, as it renders.
 */
export const processTwigParam = (template: string, variables: Record<string, unknown> = {}): unknown => {
  if (typeof template !== 'string') {
    return template;
  }

  const entry = resolveTokens(template);
  const nodes = entry ? (entry.nodes ?? entry.nodesWithSource) : null;
  const meaningful = nodes?.filter(node => node.type !== 'text' || node.value.trim() !== '');
  if (meaningful?.length !== 1 || meaningful[0].type !== 'variable') {
    // Only text with a quote in it can hold a string literal a value lands in; any other goes straight to the text.
    const document = template.includes('"') ? renderDocument(template, variables) : undefined;
    if (document !== undefined) {
      return document;
    }

    const output = processTwig(template, variables);

    return typeof output === 'string' ? jsonDocument(output) : output;
  }

  const { expression } = meaningful[0];
  try {
    const context = 'variables' in variables ? flattenContext(variables) : variables;
    const value = evaluateExpression(expression, context);
    if (value === undefined) {
      return '';
    }

    if (typeof value === 'string' && encodesJson(expression)) {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    }

    return value;
  } catch {
    return template;
  }
};
