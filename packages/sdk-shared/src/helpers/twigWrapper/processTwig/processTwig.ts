import { evaluate, evaluateExpression } from '../Evaluator';
import { finalizeRaw, flattenContext, renderSimpleTokens } from './helpers';
import { getNodes, resolveTokens } from '../TemplateCache';

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
