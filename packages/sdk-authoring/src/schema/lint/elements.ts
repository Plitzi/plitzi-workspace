import { isSvgMarkup } from '@plitzi/sdk-elements/elements/declarations';
import { hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { LOAD_STRATEGIES, RUNTIMES } from '../guard';
import { didYouMean } from '../suggest';
import { checkAttributeTemplates, checkBindings, shorten } from './elementBindings';
import { checkRequiredMessage, warnFormControls } from './forms';
import { checkIntent, warnRouteParams } from './intent';
import { checkFocusOnFieldBox, checkHeadingLevels, checkIconFont, checkPopupPosition, checkSlots } from './slots';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

/** What an author is missing after "write that element instead", by the element: how its parts are written. */
const OWNER_HINT: Partial<Record<string, string>> = {
  list: ' — its rows written out, as children (`listItem({ children: [ … ] })` each), or drawn from data with `items`.'
};

/** A sub-element that reads its parent's context throws on its first render anywhere else, taking the page with it. */
const checkAncestor = (ctx: LintContext, element: Element, where: string): void => {
  const ancestorTypes = ctx.catalogs.ancestorTypes;
  const type = element.definition.type;
  const ancestor = ancestorTypes && Object.hasOwn(ancestorTypes, type) ? ancestorTypes[type] : undefined;
  if (!ancestor || [...ctx.ancestors(element.id)].some(id => ctx.element(id)?.definition.type === ancestor)) {
    return;
  }

  ctx.error(
    'outside-ancestor',
    `${where} only works inside a "${ancestor}": it reads that element's state. Nest it in one.`,
    element.id
  );
};

/** A compound element shows what it holds through its parts — anywhere inside it: without one, nothing in it shows. */
const checkParts = (ctx: LintContext, element: Element, where: string): void => {
  const type = element.definition.type;
  const parts =
    ctx.catalogs.partTypes && Object.hasOwn(ctx.catalogs.partTypes, type) ? ctx.catalogs.partTypes[type] : [];
  if (parts.length === 0) {
    return;
  }

  const inside = new Set<string>();
  const pending = [...(element.definition.items ?? [])];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const child = ctx.element(id);
    if (child) {
      inside.add(child.definition.type);
      pending.push(...(child.definition.items ?? []));
    }
  }

  const missing = parts.filter(part => !inside.has(part));
  if (missing.length === 0) {
    return;
  }

  const named = missing.map(part => `"${part}"`).join(' and ');
  ctx.error(
    'part-missing',
    `${where} has no ${named} inside it — a "${type}" shows what it holds through ${missing.length === 1 ? 'that part' : 'those parts'}, so nothing in it shows. Add ${missing.length === 1 ? 'one' : 'them'} inside it.`,
    element.id
  );
};

/**
 * An attribute's value against what its element takes: known at all (a built-in type's attributes are exactly its
 * component's props), one of the values of an enumerated attribute, and the same kind of value its default is where
 * that decides how the component reads it — a list for a list, a flag for a flag. A template is resolved at run time,
 * so it is left to the template checks.
 */
const checkAttributes = (ctx: LintContext, element: Element, where: string): void => {
  // A `custom` host is held to the component it hosts, when that component was declared.
  const type = ctx.catalogType(element) ?? element.definition.type;
  const names = ctx.attributeNamesFor(element);
  const enums = ctx.catalogs.attributeValues?.[type] ?? {};
  const defaults = ctx.catalogs.defaultAttributes?.[type] ?? {};
  for (const [name, value] of Object.entries(element.attributes)) {
    if (names && !names.includes(name)) {
      // A drawing that names nothing — an svg, an icon — is decoration already: `label` is what makes it mean something.
      const hint = /^on[A-Z]/.test(name)
        ? ` What happens on an event is a flow: \`flows: [[${name}(), setState({ … })]]\`.`
        : name === 'decorative' && names.includes('label')
          ? ` Without a \`label\` a "${type}" is already decorative — hidden from screen readers: leave \`decorative\` out.`
          : '';
      ctx.error(
        'unknown-attribute',
        `${where} sets "${name}", which a "${type}" never reads${didYouMean(name, names) || '.'}${hint || ` It reads ${names.join(', ')}.`}`,
        element.id
      );
      continue;
    }

    if (value === undefined || value === null || (typeof value === 'string' && hasValidToken(value))) {
      continue;
    }

    if (Object.hasOwn(enums, name) && !(typeof value === 'string' && enums[name].includes(value))) {
      // A tag is an element: a `subType` this element has not but another has is that element, not a typo of a
      // tag of this one's — an `ol` is a `list`, never the `dl` two letters away.
      const tag = name === 'subType' && typeof value === 'string' ? value : undefined;
      const owner =
        tag === undefined
          ? undefined
          : Object.entries(ctx.catalogs.attributeValues ?? {}).find(
              ([other, values]) => other !== type && Object.hasOwn(values, 'subType') && values.subType.includes(tag)
            )?.[0];
      const hint =
        owner === undefined || tag === undefined
          ? `${(typeof value === 'string' && didYouMean(value, enums[name])) || '.'} It is one of ${enums[name].map(item => `'${item}'`).join(', ')}.`
          : `, which is what a "${owner}" renders: write \`${owner}({ subType: '${tag}' })\`${OWNER_HINT[owner] ?? '.'}`;
      ctx.error('attribute-value', `${where}: \`${name}\` is ${JSON.stringify(value)}${hint}`, element.id);
      continue;
    }

    const fallback = defaults[name];
    const wrongList = Array.isArray(fallback) && !Array.isArray(value);
    const wrongFlag = typeof fallback === 'boolean' && typeof value !== 'boolean';
    if (wrongList || wrongFlag) {
      ctx.error(
        'attribute-kind',
        `${where}: \`${name}\` is ${JSON.stringify(value)}, and a "${type}" reads it as ${wrongList ? 'a list — write an array, or bind it' : 'true or false — write the boolean, not text'}.`,
        element.id
      );
    }
  }

  const { runtime, loadStrategy } = element.definition;
  if (runtime !== undefined && !RUNTIMES.includes(runtime)) {
    ctx.error(
      'element-runtime',
      `${where}: \`runtime\` is ${JSON.stringify(runtime)}. It is one of ${RUNTIMES.map(item => `'${item}'`).join(', ')}.`,
      element.id
    );
  }

  if (loadStrategy !== undefined && !LOAD_STRATEGIES.includes(loadStrategy)) {
    ctx.error(
      'element-load-strategy',
      `${where}: \`loadStrategy\` is ${JSON.stringify(loadStrategy)}. It is one of ${LOAD_STRATEGIES.map(item => `'${item}'`).join(', ')}.`,
      element.id
    );
  }
};

/**
 * Children in a type that holds none: its component renders its own attributes and never reads `children`, so they
 * are dropped — a heading with two texts in it renders the word "Heading".
 */
const checkChildren = (ctx: LintContext, element: Element, where: string): void => {
  const count = element.definition.items?.length ?? 0;
  const type = element.definition.type;
  if (count === 0 || !ctx.catalogs.leafTypes?.includes(type)) {
    return;
  }

  const subType = element.attributes.subType;
  const hint =
    type === 'heading'
      ? ` For a heading made of parts — a word in another colour, an icon — use \`container({ subType: '${typeof subType === 'string' ? subType : 'h1'}', children })\`.`
      : ' Put the children in a `container` beside it, or wrap both in one.';
  ctx.error(
    'children-in-leaf',
    `${where} has ${count} ${count === 1 ? 'child' : 'children'}, but a "${type}" holds none: it renders its own attributes and drops anything nested in it.${hint}`,
    element.id
  );
};

/**
 * What is a block by what it means, not by its styles: a heading, a paragraph, a list, a form, or prose that renders
 * paragraphs of its own. A `text` or a `container` renders a `div` too, but one styled inline is what a span holds.
 */
const BLOCK_TYPES = new Set(['heading', 'paragraph', 'list', 'form', 'markdown', 'richText']);

/** What renders a `<div>` whatever it means: a block to the HTML parser inside a `<p>`, however it is styled. */
const DIV_TYPES = new Set(['text', 'formControl']);

/**
 * A `span` container is for a run of text — a dot before a title, a word dressed apart — and a `p` one for a sentence
 * made of parts, a link in the middle of it. A heading or a paragraph inside either breaks it: a span's line in two, and
 * a `<p>` the browser closes before the block, so the page it parses is not the one written.
 */
const warnSpanHoldsBlock = (ctx: LintContext, element: Element, where: string): void => {
  const tag = element.attributes.subType;
  if (element.definition.type !== 'container' || (tag !== 'span' && tag !== 'p')) {
    return;
  }

  // A `<p>` is closed by the HTML parser before ANY `<div>`, whatever it is styled: a `text`, a plain `container`,
  // a form's control — the page the server sent and the one the browser builds then differ, and hydration fails. A
  // span only breaks its line, which an inline style keeps whole: there, only what is a block by meaning counts.
  const isBlock = (child: Element): boolean =>
    BLOCK_TYPES.has(child.definition.type) ||
    (tag === 'p' &&
      (DIV_TYPES.has(child.definition.type) ||
        (child.definition.type === 'container' && child.attributes.subType !== 'span')));
  // A provider renders no DOM of its own: what it holds is the paragraph's to hold.
  const childrenOf = (ids: readonly string[]): Element[] =>
    ids.flatMap(id => {
      const child = ctx.element(id);
      if (!child) {
        return [];
      }

      return child.definition.type === 'apiContainer' ? childrenOf(child.definition.items ?? []) : [child];
    });
  const blocks = childrenOf(element.definition.items ?? []).filter(isBlock);
  if (!blocks.length) {
    return;
  }

  ctx.warn(
    'span-holds-block',
    `${where} is a \`${tag}\` but holds ${blocks.map(child => ctx.describe(child.id)).join(', ')}, which ${blocks.length === 1 ? 'is a block' : 'are blocks'}: ${tag === 'p' ? 'a browser closes a `<p>` before a `<div>` — a `text` and a plain `container` render one — so the page it builds is not the one the server sent, and hydration fails' : 'a span sits in a line of text, and a block breaks it in two'}. Make it a \`div\` (leave \`subType\` out)${tag === 'p' ? ', or write its words inline: `paragraph(…)` for the sentence, a `span` container or a `link` for its parts' : ', or put words there instead — a `text`, a `link`, inline'}.`,
    element.id
  );
};

/** An `svg` draws one `<svg>…</svg>`; anything else renders nothing at all. */
const checkSvgMarkup = (ctx: LintContext, element: Element, where: string): void => {
  const { content } = element.attributes;
  if (element.definition.type !== 'svg' || typeof content !== 'string' || content === '' || isSvgMarkup(content)) {
    return;
  }

  ctx.error(
    'svg-not-svg',
    `${where} is an \`svg\` whose \`content\` is not one \`<svg>…</svg>\` (${JSON.stringify(shorten(content))}), so it draws nothing. Give it the SVG markup alone; HTML around it belongs in a \`blockHtml\`.`,
    element.id
  );
};

export const lintElements = (ctx: LintContext): void => {
  const catalog = ctx.catalogs.attributeNames;
  const unknownTypes = new Set<string>();
  for (const element of Object.values(ctx.flat)) {
    const where = ctx.describe(element.id);
    checkBindings(ctx, element, where);
    if (ctx.pageIds.has(element.id) || ctx.layoutIds.has(element.id)) {
      continue;
    }

    // Once per type: a card repeated on twelve pages is one thing to fix, not twelve.
    const type = element.definition.type;
    if (
      catalog &&
      !Object.hasOwn(catalog, type) &&
      !ctx.catalogs.pluginTypes?.includes(type) &&
      !unknownTypes.has(type)
    ) {
      unknownTypes.add(type);
      ctx.warn(
        'unknown-element-type',
        `${where} is a "${type}", which is not a built-in type${didYouMean(type, Object.keys(catalog)) || '.'} It renders only if a plugin registers it: hand its declaration to \`authorSpace(space, { plugins: [declaration] })\` — which also checks its triggers, callbacks and attributes — or name it in \`pluginTypes: ['${type}']\`, or host your component with \`custom({ renderType: '${type}' })\`.`,
        element.id,
        { type }
      );
    }

    checkAncestor(ctx, element, where);
    checkParts(ctx, element, where);
    checkAttributes(ctx, element, where);
    checkChildren(ctx, element, where);
    warnSpanHoldsBlock(ctx, element, where);
    checkAttributeTemplates(ctx, element, where);
    checkIntent(ctx, element, where);
    checkSvgMarkup(ctx, element, where);
    checkRequiredMessage(ctx, element, where);
    checkSlots(ctx, element, where);
    checkHeadingLevels(ctx, element, where);
    checkFocusOnFieldBox(ctx, element, where);
    checkPopupPosition(ctx, element, where);
    checkIconFont(ctx, element, where);
    warnRouteParams(ctx, element, where);
  }

  warnFormControls(ctx);
};
