import { evaluate } from '../Evaluator';
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
