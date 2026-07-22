import { evaluate } from './Evaluator';
import { lex } from './Lexer';
import { parse } from './Parser';

// AST-based implementation of processTwig.
// Same API as the regex-based version: parses the template into an AST,
// evaluates it, and returns the rendered string.
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
    // Fast path: no twig syntax at all — skip the full pipeline entirely.
    if (template.indexOf('{%') === -1 && template.indexOf('{{') === -1) {
      return template;
    }

    let context = variables;
    if ('variables' in variables) {
      context = { ...(variables.variables as Record<string, unknown>), ...variables };
    }

    // 1. Lex: tokenize the template.
    const lexResult = lex(template);
    if (lexResult.error) {
      return template;
    }

    // 2. Parse: build the AST.
    const parseResult = parse(lexResult.tokens);
    if (parseResult.error) {
      return template;
    }

    // 3. Evaluate: walk the AST and produce output.
    const { output, variables: updatedContext } = evaluate(parseResult.nodes, context, keepEmptyTokens);

    // Merge any new variables from {% set %} back into the original context.
    Object.assign(variables, updatedContext);

    // Keep tokens that didn't resolve.
    if (keepEmptyTokens && output === template) {
      return template;
    }

    if (!asRaw) {
      return output;
    }

    // asRaw: try to JSON.parse the result back into typed data.
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
