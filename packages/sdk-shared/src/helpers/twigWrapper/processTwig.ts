import { applyConditionals } from './conditionals/conditionals';
import { applyLoops } from './loops/loops';
import { applyApplyTag } from './tags/apply';
import { applySet } from './tags/set';
import { renderTokens } from './tokens/renderTokens';

// Fast check: does the template contain any twig syntax? A single indexOf scan covers `{{`, `{{{`, and `{%`.
const hasTwigTags = (template: string): boolean => template.indexOf('{%') !== -1 || template.indexOf('{{') !== -1;

// Renders a user-written template: resolves `{% set %}` variables, `{% if %}` blocks, `{% for %}` loops,
// then `{{ token }}` interpolation, and finally `{% apply %}` filter blocks. `keepEmptyTokens` leaves an
// unresolved token as its literal text; `asRaw` JSON.parses the result back into typed data. Any error —
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
    // Fast path: no twig syntax at all — skip the full pipeline entirely.
    if (!hasTwigTags(template)) {
      return template;
    }

    let context = variables;
    if ('variables' in variables) {
      // Interactions carry a nested `variables` context that has to read at root level.
      // Root-level keys take precedence over nested `variables` keys.
      context = { ...(variables.variables as Record<string, unknown>), ...variables };
    }

    // 1. Process {% set %} tags first — defines variables for subsequent steps.
    // Skip when template has no set tags (most common case for rendered tokens).
    let step = template.indexOf('{% set') !== -1 ? applySet(template, context) : template;

    // 2. Process {% for %} loops — skip when no loop tags exist.
    if (step.indexOf('{%') !== -1) {
      step = applyLoops(step, context);
    }

    // 3. Process {% if %}/{% elseif %}/{% else %} conditionals — skip when no block tags exist.
    if (step.indexOf('{%') !== -1) {
      step = applyConditionals(step, context);

      // 3b. Second pass for set tags that were inside conditional blocks and skipped by step 1.
      if (step.indexOf('{% set') !== -1) {
        step = applySet(step, context);
      }
    }

    // 4. Render {{ }} and {{{ }}} tokens with filters and function calls.
    if (step.indexOf('{{') !== -1) {
      step = renderTokens(step, context, keepEmptyTokens, asRaw);
    }

    // 5. Process {% apply %} filter blocks last — applies filters to rendered content.
    if (step.indexOf('{%') !== -1) {
      step = applyApplyTag(step, context);
    }

    if (!asRaw) {
      return step;
    }

    try {
      const parsed = JSON.parse(step) as string | object;
      if (parsed) {
        return parsed;
      }

      return step;
    } catch {
      return step;
    }
  } catch {
    return template;
  }
};
