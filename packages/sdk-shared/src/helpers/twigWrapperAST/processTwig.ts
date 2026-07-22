import { evaluate } from './Evaluator';
import { lex } from './Lexer';
import { parse } from './Parser';

// Checks if a variable token's content is a simple identifier (no dots, pipes, operators).
// These can be resolved directly from context without the expression parser.
const isSimpleIdentifier = (s: string): boolean => {
  const len = s.length;
  if (len === 0) {
    return false;
  }
  const ch = s.charCodeAt(0);
  // Must start with letter or underscore.
  if (!((ch >= 97 && ch <= 122) || (ch >= 65 && ch <= 90) || ch === 95)) {
    return false;
  }
  for (let i = 1; i < len; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95) {
      continue;
    }
    return false;
  }
  return true;
};

// Resolves a simple single-segment path from context.
const resolveSimplePath = (context: Record<string, unknown>, name: string): unknown => context[name];

// Serializes a value to string output following Twig double-brace semantics.
const serializeValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
};

// Zero-allocation fast path: scans the raw template string directly for `{{ }}` pairs,
// resolving simple variables inline without creating any token or AST objects.
// Returns null if the template contains tags ({% %}), complex expressions, or triple braces.
const trySimpleFastPath = (template: string, context: Record<string, unknown>): string | null => {
  // If template contains {% tags, bail immediately.
  if (template.indexOf('{%') !== -1) {
    return null;
  }

  // If no {{ at all, nothing to resolve.
  if (template.indexOf('{{') === -1) {
    return template;
  }

  // If triple braces are present, bail (raw variables have different semantics).
  if (template.indexOf('{{{') !== -1) {
    return null;
  }

  // Single-pass scan: collect text segments and resolved variable values.
  const parts: string[] = [];
  let pos = 0;

  while (pos < template.length) {
    const varStart = template.indexOf('{{', pos);
    if (varStart === -1) {
      parts.push(template.slice(pos));
      break;
    }

    if (varStart > pos) {
      parts.push(template.slice(pos, varStart));
    }

    const varEnd = template.indexOf('}}', varStart + 2);
    if (varEnd === -1) {
      return null;
    }

    const inner = template.slice(varStart + 2, varEnd);
    const trimmed = inner.trim();
    if (!isSimpleIdentifier(trimmed)) {
      return null;
    }

    const value = resolveSimplePath(context, trimmed);
    parts.push(serializeValue(value));

    pos = varEnd + 2;
  }

  return parts.join('');
};

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

    // Zero-allocation fast path: scan the raw string directly for simple templates.
    // This bypasses the lexer and parser entirely — no token objects, no AST.
    // Only used when keepEmptyTokens=false and asRaw=false (default path).
    if (!keepEmptyTokens && !asRaw) {
      const fastResult = trySimpleFastPath(template, context);
      if (fastResult !== null) {
        return fastResult;
      }
    }

    // 1. Lex: tokenize the template.
    const lexResult = lex(template);
    if (lexResult.error) {
      return template;
    }

    const tokens = lexResult.tokens;

    // Fast path: no tags AND all variables are simple identifiers.
    // Skip the parser and expression evaluator — resolve directly.
    // Works for both normal and keepEmptyTokens/asRaw modes.
    if (!keepEmptyTokens) {
      let hasTags = false;
      let allSimple = true;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type === 'tag') {
          hasTags = true;
          break;
        }
        if (t.type === 'variable' && !isSimpleIdentifier(t.content.trim())) {
          allSimple = false;
          break;
        }
      }

      if (!hasTags && allSimple) {
        const parts: string[] = [];
        for (let i = 0; i < tokens.length; i++) {
          const t = tokens[i];
          if (t.type === 'text') {
            parts.push(t.value);
          } else if (t.type === 'variable') {
            const value = resolveSimplePath(context, t.content.trim());
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
    }

    // 2. Parse: build the AST.
    const parseResult = parse(tokens);
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
