import { evaluate } from '../Evaluator';
import { resolveDottedPath, resolveSimplePath, serializeValue, trySimpleFastPath } from './fastPath';
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

    let context = variables;
    if ('variables' in variables) {
      const flattened: Record<string, unknown> = {};
      const inner = variables.variables as Record<string, unknown>;
      for (const key in inner) {
        flattened[key] = inner[key];
      }
      for (const key in variables) {
        flattened[key] = variables[key];
      }
      context = flattened;
    }

    if (!keepEmptyTokens && !asRaw) {
      const fastResult = trySimpleFastPath(template, context);
      if (fastResult !== null) {
        return fastResult;
      }
    }

    const entry = resolveTokens(template);
    if (!entry) {
      return template;
    }

    if (!keepEmptyTokens && !entry.hasTags && entry.allSimpleOrDotted) {
      const parts: string[] = [];
      for (let i = 0; i < entry.tokens.length; i++) {
        const t = entry.tokens[i];
        if (t.type === 'text') {
          parts.push(t.value);
        } else if (t.type === 'variable') {
          const trimmed = t.content.trim();
          const value =
            t.content.indexOf('.') === -1 ? resolveSimplePath(context, trimmed) : resolveDottedPath(context, trimmed);
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          parts.push(t.raw ? (value === null || value === undefined ? '' : String(value)) : serializeValue(value));
        }
      }
      const output = parts.join('');
      if (!asRaw) {
        return output;
      }
      try {
        const parsed = JSON.parse(output) as string | object;
        if (parsed) {
          return parsed;
        }
        return output;
      } catch {
        return output;
      }
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

    if (!asRaw) {
      return output;
    }

    try {
      const parsed = JSON.parse(output) as string | object;
      if (parsed) {
        return parsed;
      }
      return output;
    } catch {
      return output;
    }
  } catch {
    return template;
  }
};
