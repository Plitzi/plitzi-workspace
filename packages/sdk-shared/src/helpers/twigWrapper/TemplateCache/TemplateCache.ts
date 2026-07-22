import { lex } from '../Lexer';
import { parse } from '../Parser';
import { isDottedPath } from '../processTwig/fastPath';

import type { ASTNode } from '../AST';
import type { Token } from '../Lexer';

export type CacheEntry = {
  tokens: readonly Token[];
  hasTags: boolean;
  allSimpleOrDotted: boolean;
  nodes: readonly ASTNode[] | null;
};

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 256;

const classifyTokens = (tokens: readonly Token[]): { hasTags: boolean; allSimpleOrDotted: boolean } => {
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
  return { hasTags, allSimpleOrDotted };
};

const parseFromTokens = (
  tokens: readonly Token[],
  keepEmptyTokens: boolean
): { nodes: readonly ASTNode[] | null; error: string | null } => {
  const { nodes, error } = parse(tokens, keepEmptyTokens);
  if (error) {
    return { nodes: null, error };
  }
  return { nodes, error: null };
};

const evictOldest = (): void => {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
};

export const resolveTokens = (template: string, keepEmptyTokens: boolean): CacheEntry | null => {
  const cached = cache.get(template);
  if (cached) {
    if (keepEmptyTokens) {
      const result = parseFromTokens(cached.tokens, true);
      if (result.error) {
        return null;
      }
      return {
        tokens: cached.tokens,
        hasTags: cached.hasTags,
        allSimpleOrDotted: cached.allSimpleOrDotted,
        nodes: result.nodes
      };
    }
    return cached;
  }

  const lexResult = lex(template);
  if (lexResult.error) {
    return null;
  }

  const tokens = lexResult.tokens;
  const { hasTags, allSimpleOrDotted } = classifyTokens(tokens);

  let nodes: readonly ASTNode[] | null = null;
  if (hasTags || !allSimpleOrDotted) {
    const result = parseFromTokens(tokens, false);
    if (result.error) {
      return null;
    }
    nodes = result.nodes;
  }

  evictOldest();
  cache.set(template, { tokens, hasTags, allSimpleOrDotted, nodes });

  if (keepEmptyTokens) {
    const result = parseFromTokens(tokens, true);
    if (!result.error) {
      return { tokens, hasTags, allSimpleOrDotted, nodes: result.nodes };
    }
  }

  return { tokens, hasTags, allSimpleOrDotted, nodes };
};
