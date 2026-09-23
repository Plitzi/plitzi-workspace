import { filters } from './filters/filters';
import { lex } from './Lexer';
import { parse } from './Parser';

import type { ASTNode, Expression } from './AST';

/** The functions a template can call, as the evaluator implements them. Anything else evaluates to `''`. */
const FUNCTIONS = new Set(['cycle', 'max', 'min', 'range']);

/** What a `for` binds besides its own variables: `{{ loop.index }}`. */
const LOOP = 'loop';

export type TemplateInspection = {
  /**
   * Everything the interpreter would read past rather than understand, in words: a character it skipped, an operator
   * it does not implement, a filter or function it does not have, a tag it drops. Empty for a template that renders
   * what it says.
   */
  issues: string[];
  /**
   * The names the template reads from its context — the first segment of every path that is not bound by the
   * template itself (a `set`, a `for` variable, an arrow's parameter). What a caller checks against what will be in
   * scope when it renders.
   */
  freeNames: string[];
};

class Inspector {
  readonly issues: string[] = [];
  readonly freeNames = new Set<string>();

  nodes(nodes: readonly ASTNode[], bound: ReadonlySet<string>): Set<string> {
    // `set` binds for the rest of the body it appears in, so the scope grows as the body is walked.
    let scope = new Set(bound);
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
        case 'break':
        case 'continue':
          break;
        case 'variable':
          this.expression(node.expression, scope);
          break;
        case 'if':
          this.expression(node.condition, scope);
          this.nodes(node.body, scope);
          for (const clause of node.elseifClauses) {
            this.expression(clause.condition, scope);
            this.nodes(clause.body, scope);
          }

          if (node.elseBody) {
            this.nodes(node.elseBody, scope);
          }

          break;
        case 'for': {
          this.expression(node.collection, scope);
          const inner = new Set([...scope, node.valueVar, LOOP, ...(node.keyVar ? [node.keyVar] : [])]);
          this.nodes(node.body, inner);
          scope = new Set([...scope, ...this.setsIn(node.body)]);
          if (node.elseBody) {
            this.nodes(node.elseBody, scope);
          }

          break;
        }
        case 'set':
          if (Array.isArray(node.value)) {
            this.nodes(node.value, scope);
          } else {
            this.expression(node.value, scope);
          }

          scope = new Set([...scope, node.name]);
          break;
        case 'apply':
          this.filterNames(node.filters.map(filter => filter.name));
          for (const filter of node.filters) {
            filter.args.forEach(arg => this.expression(arg, scope));
          }

          this.nodes(node.body, scope);
          break;
      }
    }

    return scope;
  }

  /** A `set` inside a loop body persists after the loop, as it does when the template runs. */
  private setsIn(nodes: readonly ASTNode[]): string[] {
    return nodes.flatMap(node => (node.type === 'set' ? [node.name] : []));
  }

  private filterNames(names: readonly string[]): void {
    for (const name of names) {
      if (name && !Object.hasOwn(filters, name)) {
        this.issues.push(`Unknown filter "${name}"`);
      }
    }
  }

  expression(expr: Expression, scope: ReadonlySet<string>): void {
    switch (expr.type) {
      case 'literal':
        return;
      case 'array':
        expr.elements.forEach(element => this.expression(element, scope));

        return;
      case 'object':
        for (const entry of expr.entries) {
          this.expression(entry.key, scope);
          this.expression(entry.value, scope);
        }

        return;
      case 'range':
        this.expression(expr.start, scope);
        this.expression(expr.end, scope);

        return;
      case 'path':
        if (!scope.has(expr.segments[0])) {
          this.freeNames.add(expr.segments[0]);
        }

        return;
      case 'index':
        this.expression(expr.object, scope);
        this.expression(expr.index, scope);

        return;
      case 'function':
        if (!FUNCTIONS.has(expr.name)) {
          this.issues.push(`Unknown function "${expr.name}()": the functions are ${[...FUNCTIONS].join(', ')}`);
        }

        expr.args.forEach(arg => this.expression(arg, scope));

        return;
      case 'filter':
        this.expression(expr.subject, scope);
        this.filterNames(expr.filters.map(filter => filter.name));
        for (const filter of expr.filters) {
          filter.args.forEach(arg => this.expression(arg, scope));
        }

        return;
      case 'concat':
        expr.parts.forEach(part => this.expression(part, scope));

        return;
      case 'unary':
        this.expression(expr.operand, scope);

        return;
      case 'binary':
        this.expression(expr.left, scope);
        // `x is defined`: the right side of a test names the test, not a variable.
        if (!((expr.operator === 'is' || expr.operator === 'is not') && expr.right.type === 'path')) {
          this.expression(expr.right, scope);
        }

        return;
      case 'default':
        this.expression(expr.value, scope);
        this.expression(expr.defaultExpr, scope);

        return;
      case 'ternary':
        this.expression(expr.condition, scope);
        if (expr.trueExpr) {
          this.expression(expr.trueExpr, scope);
        }

        this.expression(expr.falseExpr, scope);

        return;
      case 'arrow':
        this.expression(expr.body, new Set([...scope, ...expr.params]));
    }
  }
}

/**
 * What a template would do that its author did not write — read at author time, with the parser the runtime uses.
 *
 * The interpreter is forgiving on purpose: a page renders what it can rather than throwing. That same forgiveness is
 * what turns a typo into a plausible wrong value — `s starts with 'x'` evaluated to `s` before the test existed, and a
 * value in a condition is true. Anything that authors templates (the authoring surface, the builder) asks this first
 * and refuses what it reports.
 */
export const inspectTemplate = (template: string): TemplateInspection => {
  const lexed = lex(template);
  if (lexed.error) {
    return { issues: [lexed.error], freeNames: [] };
  }

  const inspector = new Inspector();
  const { nodes, error } = parse(lexed.tokens, false, inspector.issues);
  if (error) {
    inspector.issues.push(error);
  }

  inspector.nodes(nodes, new Set());

  return { issues: [...new Set(inspector.issues)], freeNames: [...inspector.freeNames] };
};
