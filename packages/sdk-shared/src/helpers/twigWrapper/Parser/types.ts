import type { ASTNode } from '../AST';

export type ParseResult = {
  readonly nodes: readonly ASTNode[];
  readonly error: string | null;
};
