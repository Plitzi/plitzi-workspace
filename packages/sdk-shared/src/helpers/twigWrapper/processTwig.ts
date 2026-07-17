import { applyConditionals } from './conditionals';
import { renderTokens } from './renderTokens';

// Renders a user-written template: resolves `{% if %}` blocks, then `{{ token }}` interpolation. `keepEmptyTokens`
// leaves an unresolved token as its literal text; `asRaw` JSON.parses the result back into typed data. Any error —
// or a non-string template — falls back to the original input rather than throwing.
export const processTwig = (
  template: string,
  variables: { [key: string]: unknown } = {},
  keepEmptyTokens = false,
  asRaw = false
) => {
  if (typeof template !== 'string') {
    return template;
  }

  try {
    let context = variables;
    if ('variables' in variables) {
      // Interactions carry a nested `variables` context that has to read at root level.
      context = { ...variables, ...(variables.variables as Record<string, unknown>) };
    }

    const result = renderTokens(applyConditionals(template, context), context, keepEmptyTokens, asRaw);
    if (!asRaw) {
      return result;
    }

    try {
      const parsed = JSON.parse(result) as string | object;
      if (parsed) {
        return parsed;
      }

      return result;
    } catch {
      return result;
    }
  } catch {
    return template;
  }
};
