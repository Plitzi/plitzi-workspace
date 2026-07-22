import { evaluate } from '../Evaluator';
import { lex } from '../Lexer';
import { parse } from '../Parser';
import { isDottedPath, resolveDottedPath, resolveSimplePath, serializeValue, trySimpleFastPath } from './fastPath';

import type { ASTNode } from '../AST';
import type { Token } from '../Lexer';

type CacheEntry = {
  tokens: readonly Token[];
  hasTags: boolean;
  allSimpleOrDotted: boolean;
  nodes: readonly ASTNode[] | null;
};

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 256;

const resolveTokens = (template: string, keepEmptyTokens: boolean): CacheEntry | null => {
  const cached = cache.get(template);
  if (cached) {
    if (keepEmptyTokens) {
      // Always re-parse with keepEmptyTokens=true to populate source fields
      const parseResult = parse(cached.tokens, true);
      if (parseResult.error) {
        return null;
      }
      return {
        tokens: cached.tokens,
        hasTags: cached.hasTags,
        allSimpleOrDotted: cached.allSimpleOrDotted,
        nodes: parseResult.nodes
      };
    }
    return cached;
  }

  const lexResult = lex(template);
  if (lexResult.error) {
    return null;
  }

  const tokens = lexResult.tokens;
  let hasTags = false;
  let allSimpleOrDotted = true;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'tag') {
      hasTags = true;
      break;
    }
    if (t.type === 'variable' && !isDottedPath(t.content.trim())) {
      allSimpleOrDotted = false;
      break;
    }
  }

  let nodes: readonly ASTNode[] | null = null;
  if (hasTags || !allSimpleOrDotted) {
    // Only cache with keepEmptyTokens=false (source fields not populated)
    const parseResult = parse(tokens, false);
    if (parseResult.error) {
      return null;
    }
    nodes = parseResult.nodes;
  }

  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(template, { tokens, hasTags, allSimpleOrDotted, nodes });

  // If keepEmptyTokens was requested, re-parse to populate source fields
  if (keepEmptyTokens) {
    const parseResult = parse(tokens, true);
    if (!parseResult.error) {
      return { tokens, hasTags, allSimpleOrDotted, nodes: parseResult.nodes };
    }
  }

  return { tokens, hasTags, allSimpleOrDotted, nodes };
};

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

    const entry = resolveTokens(template, keepEmptyTokens);
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

    if (!entry.nodes) {
      return template;
    }

    const { output, variables: updatedContext, hasSet } = evaluate(entry.nodes, context, keepEmptyTokens);

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
