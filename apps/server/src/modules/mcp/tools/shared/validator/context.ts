import type { ValidationError } from '../../../types';
import type { Style } from '@plitzi/sdk-shared';

// Shared validation context + the generic, cross-op checks that read from it. Each op-family check module
// (refs, css, elements) takes this ctx and appends to its errors/warnings.

// A {{name}} binding: only a bare identifier/path between the braces — never the multiline JS/JSX object
// literals that live in code-bearing element props (those never match a lone identifier).
const VAR_REF = /\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g;
const CSS_VAR = /var\(\s*--([A-Za-z_][\w-]*)\s*\)/g;

// Types whose props carry raw JSX/HTML/JS, where `{{ ... }}` is code (e.g. JSX object shorthand), not a Plitzi
// variable reference. Their props are skipped by the {{name}} check to avoid false positives.
export const RAW_CODE_TYPES = new Set(['blockJsx', 'blockHtml', 'custom']);

export interface ValidationCtx {
  errors: ValidationError[];
  warnings: string[];
  warned: Set<string>;
  knownTypes: Set<string>;
  typeProps: Map<string, Set<string>>; // observed prop keys per element type (I5)
  schemaVars: Set<string>; // valid {{name}}: space schema variables ∪ page route params ∪ batch-declared
  styleVars: Set<string>; // valid var(--name): design tokens across all categories
  style: Style; // to check that an applied variant is actually declared on its class
  batchVariants: Map<string, Set<string>>; // variant names each class declares within this batch (class → names)
  observedActions: Set<string>; // interaction actions seen anywhere in the space (lenient warning basis)
  observedSources: Set<string>; // binding source paths seen anywhere in the space (lenient warning basis)
}

export const warnOnce = (ctx: ValidationCtx, message: string): void => {
  if (!ctx.warned.has(message)) {
    ctx.warned.add(message);
    ctx.warnings.push(message);
  }
};

export const checkVarRefs = (text: string, path: string, ctx: ValidationCtx): void => {
  for (const match of text.matchAll(VAR_REF)) {
    const name = match[1];
    if (!ctx.schemaVars.has(name)) {
      warnOnce(
        ctx,
        `Unknown variable {{${name}}} at ${path}: not a space schema variable or a page route param. ` +
          'Read plitzi://schema-variables, or use a route param from the page skeleton (routeParams).'
      );
    }
  }
};

export const checkStyleVarRefs = (text: string, path: string, ctx: ValidationCtx): void => {
  for (const match of text.matchAll(CSS_VAR)) {
    const name = match[1];
    if (!ctx.styleVars.has(name)) {
      const tokens = [...ctx.styleVars];
      const available =
        tokens.length > 0
          ? `Available tokens: ${tokens.slice(0, 30).join(', ')}${tokens.length > 30 ? ', …' : ''}.`
          : 'Read plitzi://style-variables for the valid token names.';
      warnOnce(ctx, `Unknown style variable var(--${name}) at ${path}: not a design token in this space. ${available}`);
    }
  }
};

export const checkObservedName = (
  value: string | undefined,
  observed: Set<string>,
  kind: string,
  resource: string,
  path: string,
  ctx: ValidationCtx
): void => {
  if (!value || observed.size === 0 || observed.has(value)) {
    return;
  }

  warnOnce(
    ctx,
    `${kind} "${value}" at ${path} was not seen in this space. Verify against ${resource}; it may still be valid.`
  );
};
