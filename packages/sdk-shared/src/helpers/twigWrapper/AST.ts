// AST node types for the Twig template parser.
// Each node represents a syntactic construct in the template.

export type ASTNode = TextNode | VariableNode | IfNode | ForNode | SetNode | ApplyNode | BreakNode | ContinueNode;

// Plain text between tags
export type TextNode = {
  readonly type: 'text';
  readonly value: string;
};

// Variable interpolation: `{{ expr }}` or `{{{ expr }}}`
export type VariableNode = {
  readonly type: 'variable';
  readonly raw: boolean; // true for {{{ }}} (raw output), false for {{ }}
  readonly expression: Expression;
  readonly source: string; // original token text, e.g. "{{ a }}" — used by keepEmptyTokens
};

// `{% if condition %}...{% elseif ... %}...{% else %}...{% endif %}`
export type IfNode = {
  readonly type: 'if';
  readonly condition: Expression;
  readonly body: ASTNode[];
  readonly elseifClauses: readonly { readonly condition: Expression; readonly body: ASTNode[] }[];
  readonly elseBody: ASTNode[] | null;
};

// `{% for var[, key] in collection %}...{% else %}...{% endfor %}`
export type ForNode = {
  readonly type: 'for';
  readonly valueVar: string;
  readonly keyVar: string | null;
  readonly collection: Expression;
  readonly body: ASTNode[];
  readonly elseBody: ASTNode[] | null;
};

// `{% set var = expr %}` or `{% set var %}...{% endset %}`
export type SetNode = {
  readonly type: 'set';
  readonly name: string;
  readonly value: Expression | ASTNode[];
};

// `{% apply filter1|filter2|... %}...{% endapply %}`
export type ApplyNode = {
  readonly type: 'apply';
  readonly filters: FilterCall[];
  readonly body: ASTNode[];
};

// `{% break %}`
export type BreakNode = {
  readonly type: 'break';
};

// `{% continue %}`
export type ContinueNode = {
  readonly type: 'continue';
};

// ── Expressions ──────────────────────────────────────────────────────────────

export type Expression =
  | LiteralNode
  | ArrayLiteralNode
  | RangeNode
  | PathNode
  | FunctionNode
  | FilterExpression
  | ConcatNode
  | UnaryNode
  | BinaryNode
  | DefaultNode
  | TernaryNode;

// Literal values: strings, numbers, booleans
export type LiteralNode = {
  readonly type: 'literal';
  readonly value: string | number | boolean;
};

// Array literal: `[1, 2, 3]` or `["odd", "even"]`
export type ArrayLiteralNode = {
  readonly type: 'array';
  readonly elements: readonly Expression[];
};

// Range expression: `0..4` or `start..end`
export type RangeNode = {
  readonly type: 'range';
  readonly start: Expression;
  readonly end: Expression;
};

// Variable path: `user.name`, `items.0`, `apiContainer_data-x.field`
export type PathNode = {
  readonly type: 'path';
  readonly segments: readonly string[];
};

// Function call: `cycle(arr, index)`, `max(a, b)`
export type FunctionNode = {
  readonly type: 'function';
  readonly name: string;
  readonly args: readonly Expression[];
};

// Filter chain: `value | upper | truncate(10)`
export type FilterExpression = {
  readonly type: 'filter';
  readonly subject: Expression;
  readonly filters: readonly FilterCall[];
};

// A single filter application. Arguments are parsed into expressions up front, so the Evaluator never
// re-parses argument strings at render time (important inside loops, where a filter runs per iteration).
export type FilterCall = {
  readonly name: string;
  readonly args: readonly Expression[];
};

// Concatenation: `a ~ b ~ c`
export type ConcatNode = {
  readonly type: 'concat';
  readonly parts: readonly Expression[];
};

// Unary operators: `not expr`
export type UnaryNode = {
  readonly type: 'unary';
  readonly operator: 'not';
  readonly operand: Expression;
};

// Binary operators: `and`, `or`, `==`, `!=`, `>`, `<`, `>=`, `<=`, `in`, `not in`, `is`, `is not`
export type BinaryNode = {
  readonly type: 'binary';
  readonly operator: string;
  readonly left: Expression;
  readonly right: Expression;
};

// Default operator: `expr ?? default`
export type DefaultNode = {
  readonly type: 'default';
  readonly value: Expression;
  readonly defaultExpr: Expression;
};

// Ternary operator: `condition ? trueExpr : falseExpr`
export type TernaryNode = {
  readonly type: 'ternary';
  readonly condition: Expression;
  readonly trueExpr: Expression;
  readonly falseExpr: Expression;
};
