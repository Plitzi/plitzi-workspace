import { GLOBAL_SOURCE_FIELDS } from '@plitzi/sdk-shared/dataSource/globalSources';
import { templatePaths } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { didYouMean } from '../suggest';

import type { LintContext } from './context';
import type { ShapedGlobalSource } from '@plitzi/sdk-shared/dataSource/globalSources';

const isShaped = (source: string): source is ShapedGlobalSource => Object.hasOwn(GLOBAL_SOURCE_FIELDS, source);

/** A global and the field read of it, at the start of a path: `auth.isAuthenticated`, `navigation.queryParams.next`. */
const GLOBAL_FIELD = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/;

/** A flag the space does not declare: the read resolves to nothing, so what it gates is silently off. */
export const reportUnknownFlag = (ctx: LintContext, name: string, where: string, id?: string): void => {
  ctx.error(
    'flag-unknown',
    `${where} reads "flags.${name}", which the space does not declare${didYouMean(name, ctx.flags) || '.'} Declare it in \`flags\`: { ${name}: { value: false, rules: [] } }.`,
    id
  );
};

/** A computed value the space does not compute, read from anywhere but another computed value. */
export const reportUnknownComputed = (ctx: LintContext, name: string, where: string, id?: string): void => {
  ctx.error(
    'computed-unknown',
    `${where} reads "computed.${name}", which the space does not compute${didYouMean(name, ctx.computed) || '.'} Declare it in \`computed\`: { ${name}: '{{ … }}' }.`,
    id
  );
};

/** A field of `navigation`, `auth` or `theme` that the source never publishes (`GLOBAL_SOURCE_FIELDS`). */
const checkShapedField = (
  ctx: LintContext,
  source: ShapedGlobalSource,
  field: string,
  where: string,
  id?: string
): void => {
  const fields = Object.keys(GLOBAL_SOURCE_FIELDS[source]);
  if (fields.includes(field)) {
    return;
  }

  const paths = fields.map(name => `${source}.${name}`);
  ctx.error(
    'global-field-unknown',
    `${where} reads "${source}.${field}", which the \`${source}\` source never has — it reads as nothing, always${didYouMean(`${source}.${field}`, paths) || '.'} \`${source}\` holds ${paths.join(', ')}.`,
    id
  );
};

/**
 * A path that starts at a global — a binding's `source`, a condition's `field` — held to what that global has: the
 * fields `navigation`, `auth` and `theme` publish, the flags and computed values the space declares. Any other global
 * (`state`, `host`, `variables`) and any element's source say nothing here.
 */
export const checkGlobalRead = (ctx: LintContext, path: string, where: string, id?: string): void => {
  const [, source = '', field = ''] = GLOBAL_FIELD.exec(path) ?? [];
  if (isShaped(source)) {
    checkShapedField(ctx, source, field, where, id);
  } else if (source === 'flags' && !ctx.flags.includes(field)) {
    reportUnknownFlag(ctx, field, where, id);
  } else if (source === 'computed' && !ctx.computed.includes(field)) {
    reportUnknownComputed(ctx, field, where, id);
  }
};

/** A global and one field read of it: `['auth', 'status']`. */
export type GlobalRead = [source: string, field: string];

/**
 * Every `<global>.<field>` a template reads, off the parsed template: a string literal that only looks like one
 * (`'https://auth.acme.com'`) is not a read, nor is a field of something else (`post.auth.name`).
 */
export const globalFieldsRead = (template: string): GlobalRead[] =>
  templatePaths(template).flatMap(path => {
    const [source = '', field] = path.split('.');

    return field ? [[source, field]] : [];
  });

/** Every field of `navigation`, `auth` or `theme` a template reads, held to what the source publishes. */
export const checkShapedReads = (ctx: LintContext, reads: GlobalRead[], where: string, id?: string): void => {
  for (const [source, field] of reads) {
    if (isShaped(source)) {
      checkShapedField(ctx, source, field, where, id);
    }
  }
};
