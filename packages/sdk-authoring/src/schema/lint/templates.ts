import { hasTemplateSyntax, inspectTemplate } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { GLOBAL_SOURCES } from '../bindings';
import { didYouMean } from '../suggest';

import type { LintContext } from './context';

/** Where one template is evaluated, which decides the names it may read beyond the sources in scope. */
export type TemplateSite =
  /** A binding's `twigTemplate`: the bound value as `source`, the attribute's previous value as `sourceTo`. */
  | { kind: 'binding' }
  /** An attribute's `{{ token }}`: the route params of the page it renders on, flattened to bare names. */
  | { kind: 'attribute'; routeParams: readonly string[] }
  /** One of the space's computed values: the globals and the values declared before it. */
  | { kind: 'computed'; earlier: readonly string[] }
  /** A flow step's params: read in a scope of their own (the trigger's payload, earlier steps), so only syntax. */
  | { kind: 'step' };

/** The names a binding's template is handed besides the sources — see the `twigTemplate` transformer. */
const BINDING_NAMES = new Set(['source', 'sourceTo']);

const shorten = (template: string): string => (template.length > 80 ? `${template.slice(0, 77)}…` : template);

/**
 * Every `computed.<name>` a template reads has to be one the space declares — and, inside a computed value, one
 * declared above it: they are evaluated in order, so a later one is not there yet.
 */
const checkComputedReads = (ctx: LintContext, template: string, where: string, site: TemplateSite, id?: string) => {
  const readable = site.kind === 'computed' ? site.earlier : ctx.computed;
  for (const [, name = ''] of template.matchAll(/\bcomputed\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (readable.includes(name)) {
      continue;
    }

    const later = site.kind === 'computed' && ctx.computed.includes(name);
    ctx.error(
      'computed-unknown',
      later
        ? `${where} reads "computed.${name}", which is declared after it. Computed values are evaluated in order: move "${name}" above.`
        : `${where} reads "computed.${name}", which the space does not compute${didYouMean(name, ctx.computed) || '.'} Declare it in \`computed\`: { ${name}: '{{ … }}' }.`,
      id
    );
  }
};

/** One name a template reads, against what will be in scope where it renders. */
const checkName = (
  ctx: LintContext,
  name: string,
  template: string,
  where: string,
  site: TemplateSite,
  ancestors: ReadonlySet<string>,
  id?: string
): void => {
  if (GLOBAL_SOURCES.includes(name) || ctx.variables.has(name)) {
    return;
  }

  if (site.kind === 'computed') {
    ctx.error(
      'computed-reads-element',
      `${where} reads "${name}" in "${shorten(template)}". A computed value reads only the globals (${GLOBAL_SOURCES.join(', ')}) and the space's variables — it belongs to the whole space, so no element's source is around it. Compute from \`state\`, or bind the element's source on the element itself.`,
      id
    );

    return;
  }

  if (
    site.kind === 'binding' ? BINDING_NAMES.has(name) : site.kind === 'attribute' && site.routeParams.includes(name)
  ) {
    return;
  }

  const shortPrefix = ctx.sources.get(name);
  if (shortPrefix) {
    ctx.error(
      'template-short-source',
      `${where} reads "${name}" in "${shorten(template)}". Inside a template a source is named in full — write "${shortPrefix}_${name}" where it says "${name}". (A binding's own \`source\` is completed for you; a template is read as written.)`,
      id
    );

    return;
  }

  const separator = name.indexOf('_');
  const sourceId = separator === -1 ? '' : name.slice(separator + 1);
  const prefix = ctx.sources.get(sourceId);
  if (prefix && name === `${prefix}_${sourceId}`) {
    if (!ancestors.has(sourceId) && !ctx.inLayout(sourceId)) {
      ctx.error(
        'template-source-out-of-scope',
        `${where} reads "${name}" in "${shorten(template)}", but "${sourceId}" is not around it. An element's source reaches only the elements inside it — move this one into "${sourceId}", or read the value through something both can see, like \`state\`.`,
        id
      );
    }

    return;
  }

  const known = [...GLOBAL_SOURCES, ...ctx.variables, ...[...ctx.sources].map(([key, value]) => `${value}_${key}`)];
  const flattened =
    site.kind === 'attribute'
      ? ` A query parameter is \`navigation.queryParams.${name}\`${site.routeParams.length > 0 ? `; this page's route params are ${site.routeParams.join(', ')}` : ''}.`
      : ' The bound value is `source`.';
  ctx.error(
    'template-unknown-name',
    `${where} reads "${name}" in "${shorten(template)}", which nothing here answers to${didYouMean(name, known) || '.'} A template reads the globals (${GLOBAL_SOURCES.join(', ')}), the space's variables, and an element's source named in full (\`list_rows\`, \`apiContainer_posts\`) from inside that element.${flattened}`,
    id
  );
};

/**
 * A template read the way the runtime will read it: refused when the interpreter would read past part of it — it
 * renders a value nobody wrote — and, where the scope is known, when a name in it is one nothing will answer.
 *
 * Names are held only when the source catalogue was supplied: without it an element's source cannot be told from a
 * typo, and the composed surface always supplies it.
 */
export const checkTemplate = (
  ctx: LintContext,
  template: string,
  where: string,
  site: TemplateSite,
  ancestors: ReadonlySet<string> = new Set(),
  id?: string
): void => {
  if (!hasTemplateSyntax(template)) {
    return;
  }

  const { issues, freeNames } = inspectTemplate(template);
  checkComputedReads(ctx, template, where, site, id);
  if (issues.length > 0) {
    ctx.error(
      'template-unreadable',
      `${where}: the template "${shorten(template)}" cannot be read as written — ${issues.join('; ')}. The interpreter would skip what it cannot read and render a value nobody wrote.`,
      id
    );

    return;
  }

  if (!ctx.catalogs.sourceTypes || site.kind === 'step') {
    return;
  }

  for (const name of freeNames) {
    checkName(ctx, name, template, where, site, ancestors, id);
  }
};

/** The space's computed values: names a template can say, each a template reading only globals and those above it. */
export const lintComputed = (ctx: LintContext): void => {
  const declared: string[] = [];
  for (const [name, template] of Object.entries(ctx.schema.settings.computed ?? {})) {
    const where = `Computed value "${name}"`;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      ctx.error(
        'computed-name',
        `${where} is not a name a template can read as \`computed.${name}\`. Use letters, digits and "_", starting with a letter: "${name.replace(/[^A-Za-z0-9_]/g, '_')}".`
      );
    } else if (typeof template !== 'string' || !template.includes('{{')) {
      ctx.error(
        'computed-not-template',
        `${where} is ${JSON.stringify(template)}. A computed value is a template: '{{ state.x * 2 }}'.`
      );
    } else {
      checkTemplate(ctx, template, where, { kind: 'computed', earlier: [...declared] });
    }

    declared.push(name);
  }
};
