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
  nodesWithSource: readonly ASTNode[] | null;
};

export type CacheStats = {
  hits: number;
  misses: number;
};

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 256;
const stats: CacheStats = { hits: 0, misses: 0 };

export const getCacheStats = (): CacheStats => ({ hits: stats.hits, misses: stats.misses });

export const resetCacheStats = (): void => {
  stats.hits = 0;
  stats.misses = 0;
};

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

const evictOldest = (): void => {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
};

const lexAndParse = (template: string): CacheEntry | null => {
  const lexResult = lex(template);
  if (lexResult.error) {
    return null;
  }

  const tokens = lexResult.tokens;
  const { hasTags, allSimpleOrDotted } = classifyTokens(tokens);
  const needsParse = hasTags || !allSimpleOrDotted;

  let nodes: readonly ASTNode[] | null = null;
  let nodesWithSource: readonly ASTNode[] | null = null;

  if (needsParse) {
    const baseResult = parse(tokens, false);
    if (baseResult.error) {
      return null;
    }
    nodes = baseResult.nodes;

    const sourceResult = parse(tokens, true);
    if (!sourceResult.error) {
      nodesWithSource = sourceResult.nodes;
    }
  } else {
    // Simple variable templates: parse with source for keepEmptyTokens=true path
    const sourceResult = parse(tokens, true);
    if (!sourceResult.error) {
      nodesWithSource = sourceResult.nodes;
    }
  }

  return { tokens, hasTags, allSimpleOrDotted, nodes, nodesWithSource };
};

export const resolveTokens = (template: string): CacheEntry | null => {
  const cached = cache.get(template);
  if (cached) {
    stats.hits++;
    return cached;
  }

  stats.misses++;

  const entry = lexAndParse(template);
  if (!entry) {
    return null;
  }

  evictOldest();
  cache.set(template, entry);

  return entry;
};

export const getNodes = (entry: CacheEntry, keepEmptyTokens: boolean): readonly ASTNode[] | null => {
  return keepEmptyTokens ? entry.nodesWithSource : entry.nodes;
};
