import { NAMEABLE_CONTAINER_TAGS } from '@plitzi/sdk-elements/elements/structure/Container/declaration';

import { textOf } from './context';
import { elementAttributeNames } from '../../elements/attributeNames';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

/**
 * What a page is to someone who cannot see it — and to a browser agent (Claude in Chrome), which reads a page the same
 * way: through the accessibility tree the browser builds from it, where a control is its role and its name. A button
 * with no words is announced as "button" and nothing else; a clickable box is not in the tree at all; a picture with
 * no description is a file name. None of it is broken to the eye, so nothing else would say so.
 *
 * Warnings, all of them: the page renders, and does what it was built to — for the people who can see it.
 */

/**
 * The attributes a control's name can come from, by type. What a type does not list here names nothing.
 *
 * `content` on a button is its visible text; `title` is the tooltip the browser falls back to when there is none.
 */
const NAMING_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  button: ['content', 'title', 'label'],
  link: ['content', 'label'],
  formControl: ['label'],
  text: ['content'],
  heading: ['content'],
  paragraph: ['content'],
  markdown: ['content'],
  richText: ['content'],
  image: ['alt'],
  fontAwesome: ['label']
};

/**
 * What an attribute left out renders as, where the component's default is words — so a document that never wrote one
 * is not taken for one that wrote it empty. The catalogue says so when it was handed in; these are the same defaults,
 * for a lint run without one.
 */
const WORDY_DEFAULTS: Readonly<Partial<Record<string, Readonly<Record<string, string>>>>> = {
  button: { content: 'Button' },
  formControl: { label: 'Label' },
  heading: { content: 'Heading' },
  paragraph: { content: 'Paragraph' },
  text: { content: 'Text' }
};

/** Built-in types whose markup is somebody else's to say — a component of the project's, raw HTML or JSX. */
const OPAQUE_TYPES = new Set(['custom', 'blockHtml', 'blockJsx', 'nodeHtml', 'reference']);

/** What the linter cannot read words in: those, and any type not built in — a plugin's, which may well say something. */
const isOpaque = (type: string): boolean => OPAQUE_TYPES.has(type) || !Object.hasOwn(elementAttributeNames, type);

/**
 * Types that render a box with no role of its own: a click on one reaches neither a keyboard nor the accessibility
 * tree. The interactive types (`button`, `link`, a form control, the theme toggle) and the ones whose component wires
 * its own clicks (tabs, dropdowns, overlays) are not here.
 */
const STATIC_TYPES = new Set([
  'container',
  'text',
  'heading',
  'paragraph',
  'markdown',
  'richText',
  'image',
  'fontAwesome',
  'video',
  'embed',
  'svg',
  'list',
  'listItem'
]);

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/**
 * The fields a browser names by their placeholder when nothing else does: the ones typed into. A swatch, a date or a
 * checkbox is never named by one.
 */
const PLACEHOLDER_NAMED = new Set(['text', 'number', 'email', 'password', 'textarea']);

const boundAttributes = (element: Element): Set<string> =>
  new Set(Object.values(element.definition.bindings ?? {}).flatMap(list => list.map(binding => binding.to)));

/** The value an attribute renders with: the document's, else the catalogue's default, else the component's words. */
const attributeValue = (ctx: LintContext, element: Element, name: string): unknown => {
  const { type } = element.definition;
  if (Object.hasOwn(element.attributes, name)) {
    return element.attributes[name];
  }

  const catalogued = ctx.catalogs.defaultAttributes?.[type];
  if (catalogued && Object.hasOwn(catalogued, name)) {
    return catalogued[name];
  }

  return WORDY_DEFAULTS[type]?.[name];
};

/** Words, or what becomes words at run time — a template is words too, or a binding onto the attribute. */
const says = (ctx: LintContext, element: Element, name: string): boolean => {
  if (boundAttributes(element).has(name)) {
    return true;
  }

  const value = attributeValue(ctx, element, name);
  if (typeof value === 'number') {
    return true;
  }

  return textOf(value).trim() !== '';
};

const isDecorative = (element: Element): boolean => element.attributes.decorative === true;

/** Inside a container marked `decorative`: an illustration assistive technology is told to skip, whatever it holds. */
const inIllustration = (ctx: LintContext, id: string): boolean =>
  [id, ...ctx.ancestors(id)].some(each => {
    const element = ctx.element(each);

    return element?.definition.type === 'container' && isDecorative(element);
  });

const CONTROL_TYPES = new Set(['button', 'link', 'formControl', 'themeToggle']);

/**
 * A control inside an illustration. `aria-hidden` takes it out of what is read, not out of the Tab order, so a keyboard
 * lands on it and hears nothing — and a browser agent never finds it.
 */
const warnControlInIllustration = (ctx: LintContext, element: Element, where: string): void => {
  if (!CONTROL_TYPES.has(element.definition.type)) {
    return;
  }

  ctx.warn(
    'control-in-decorative',
    `${where} is a control inside a \`decorative\` container, which screen readers and browser agents are told to skip — but a keyboard still reaches it, and lands on something nothing announces. Move it out of the illustration, or make the illustration's part a plain element and offer the action outside it.`,
    element.id
  );
};

/**
 * Whether anything in `id`'s subtree gives it words: text, a described picture, an icon with a meaning, or markup the
 * linter cannot read (a plugin may well say something, and a warning it cannot prove would teach people to ignore it).
 */
const hasWordsInside = (ctx: LintContext, id: string): boolean =>
  (ctx.element(id)?.definition.items ?? []).some(childId => {
    const child = ctx.element(childId);
    if (!child) {
      return false;
    }

    const { type } = child.definition;
    if (isOpaque(type)) {
      return true;
    }

    // A picture waiting for its description is the picture's warning, not the control's: one fix, said once.
    if (type === 'image' && !isDecorative(child) && !says(ctx, child, 'alt')) {
      return true;
    }

    const own = (NAMING_ATTRIBUTES[type] ?? []).some(
      name => (type !== 'image' || !isDecorative(child)) && says(ctx, child, name)
    );

    return own || hasWordsInside(ctx, childId);
  });

const FIXES: Readonly<Record<'button' | 'link', string>> = {
  button:
    'Give it a `title` saying what it does — `button({ title: "Close", … })` — which is also its tooltip, or words of its own in `content`.',
  link: 'Give it words of its own in `content` — `link({ content: "Pricing", … })` — or, where its words are an icon or a picture, a `label` saying where it goes: `link({ label: "Your profile", … })`.'
};

/** A button, a link or a form field that nothing names. */
const warnUnnamedControl = (ctx: LintContext, element: Element, where: string): void => {
  const { type } = element.definition;
  if (type === 'formControl') {
    const subType = textOf(attributeValue(ctx, element, 'subType'), 'text');
    const named = says(ctx, element, 'label') || (PLACEHOLDER_NAMED.has(subType) && says(ctx, element, 'placeholder'));
    if (subType === 'hidden' || named) {
      return;
    }

    ctx.warn(
      'control-without-name',
      `${where} is a "${subType}" field with nothing naming it, so a screen reader or a browser agent finds an unnamed box and cannot tell what it is for. Give it a \`label\` — with \`hideLabel: true\` when the design already says what it is (a swatch, a search box with a magnifier), which keeps the name and hides the words.`,
      element.id
    );

    return;
  }

  if (type !== 'button' && type !== 'link') {
    return;
  }

  if (NAMING_ATTRIBUTES[type].some(name => says(ctx, element, name)) || hasWordsInside(ctx, element.id)) {
    return;
  }

  const fix = FIXES[type];
  ctx.warn(
    'control-without-name',
    `${where} has no words: an icon, a picture without \`alt\` or nothing at all. A screen reader announces it as just "${type}", and a browser agent (Claude in Chrome) cannot tell it from the next one. ${fix}`,
    element.id
  );
};

const warnImageWithoutAlt = (ctx: LintContext, element: Element, where: string): void => {
  if (element.definition.type !== 'image' || isDecorative(element) || says(ctx, element, 'alt')) {
    return;
  }

  ctx.warn(
    'image-without-alt',
    `${where} has no \`alt\`, so to a screen reader and a browser agent it is a file with no meaning. Say what it shows, for this page — \`alt: 'Maya presenting the roadmap'\` — or, if it only decorates, \`decorative: true\`.`,
    element.id
  );
};

/** A frame says what it shows in `title`: without one a screen reader announces only that there is a frame. */
const warnEmbedWithoutTitle = (ctx: LintContext, element: Element, where: string): void => {
  if (element.definition.type !== 'embed' || says(ctx, element, 'title')) {
    return;
  }

  ctx.warn(
    'embed-without-title',
    `${where} has no \`title\`, so a screen reader announces a frame and nothing about it. Say what it shows: \`title: 'Our shop on the map'\`.`,
    element.id
  );
};

const firesOnClick = (element: Element): boolean =>
  Object.values(element.definition.interactions ?? {}).some(
    node => node.type === 'trigger' && node.action === 'onClick' && node.enabled && node.elementId === element.id
  );

/**
 * A click on a box. It works with a mouse; a keyboard never reaches it, a screen reader does not know it does anything,
 * and a browser agent reading the page's accessibility tree finds no control there to press.
 *
 * An empty layer is left alone — the backdrop behind a panel that closes it on click is a second way out, and the
 * panel's own close button and Escape are the ones everybody can use.
 */
const warnClickOnStaticElement = (ctx: LintContext, element: Element, where: string): void => {
  const { type, items = [] } = element.definition;
  if (!STATIC_TYPES.has(type) || !firesOnClick(element)) {
    return;
  }

  const empty = items.length === 0 && !(NAMING_ATTRIBUTES[type] ?? []).some(name => says(ctx, element, name));
  if (empty) {
    return;
  }

  ctx.warn(
    'click-on-static-element',
    `${where} runs a flow on click, but a "${type}" is not a control: a keyboard cannot reach it, a screen reader does not say it can be pressed, and a browser agent (Claude in Chrome) does not find it among the page's controls. Make the clickable part a \`button\` — it holds children, so a whole card can be one — or a \`link\` when it goes somewhere, and move the flow onto it.`,
    element.id
  );
};

const warnIgnoredRegionName = (ctx: LintContext, element: Element, where: string): void => {
  if (element.definition.type !== 'container' || !says(ctx, element, 'label')) {
    return;
  }

  const subType = textOf(attributeValue(ctx, element, 'subType'), 'div');
  if (NAMEABLE_CONTAINER_TAGS.some(tag => tag === subType)) {
    return;
  }

  ctx.warn(
    'label-ignored',
    `${where} is a "${subType}" with a \`label\`, which nobody reads: it takes its name from what it holds. Put the words inside it — or, if it is a part of the page of its own, make it one of ${NAMEABLE_CONTAINER_TAGS.map(tag => `'${tag}'`).join(', ')}.`,
    element.id
  );
};

/**
 * Whether `id`'s subtree holds something a keyboard can reach — or markup the linter cannot read, which may — leaving
 * out a dropdown's popup, wherever it is nested: what is in the menu cannot be what opens it.
 */
const holdsControl = (ctx: LintContext, id: string): boolean =>
  (ctx.element(id)?.definition.items ?? []).some(childId => {
    const type = ctx.element(childId)?.definition.type ?? '';
    if (type === 'dropdownPopup') {
      return false;
    }

    return CONTROL_TYPES.has(type) || isOpaque(type) || holdsControl(ctx, childId);
  });

/**
 * A dropdown opened by a box or an icon. The dropdown opens on a click anywhere outside its popup, so it works with a
 * mouse; but nothing there is a control, so a keyboard cannot open it and a browser agent does not find it — and what
 * the menu holds (an account's settings, a sign-out) is out of their reach. With a button there, the dropdown marks it
 * (`aria-haspopup`, `aria-expanded`) and moves the focus in and back out.
 */
const warnDropdownWithoutControl = (ctx: LintContext, element: Element, where: string): void => {
  if (element.definition.type !== 'dropdown') {
    return;
  }

  // Nothing outside the popup: a dropdown only a flow opens has no click to put anywhere.
  const outside = (id: string): string[] =>
    (ctx.element(id)?.definition.items ?? []).flatMap(childId =>
      ctx.element(childId)?.definition.type === 'dropdownPopup' ? [] : [childId, ...outside(childId)]
    );
  if (outside(element.id).length === 0 || holdsControl(ctx, element.id)) {
    return;
  }

  ctx.warn(
    'dropdown-without-control',
    `${where} opens from something that is not a control, so a keyboard cannot open it and a browser agent does not find it — nor what its menu holds. Make what opens it a \`button\` — \`button({ content: '', title: 'Account', children: [avatar] })\` — and the dropdown says on it that it opens a menu, and whether it is open.`,
    element.id
  );
};

/** The heading level an element renders, if it renders one. */
const headingLevel = (ctx: LintContext, element: Element): number | undefined => {
  const { type } = element.definition;
  if (type !== 'heading' && type !== 'container') {
    return undefined;
  }

  const tag = textOf(attributeValue(ctx, element, 'subType'), type === 'heading' ? 'h1' : 'div');

  return HEADING_TAGS.has(tag) ? Number(tag.slice(1)) : undefined;
};

/**
 * Headings that skip a level on a page — an `h2` straight to an `h4`. Screen readers and browser agents read a page's
 * outline from its headings and jump between them by level; a skipped one reads as a missing section.
 *
 * Read per page, in the order the page renders; the layout's headings are the layout's to check, once, not on every
 * page it wraps.
 */
const warnSkippedHeadings = (ctx: LintContext): void => {
  for (const pageId of ctx.pageIds) {
    let previous: number | undefined;
    const walk = (id: string): void => {
      const element = ctx.element(id);
      if (!element) {
        return;
      }

      if (element.definition.type === 'container' && isDecorative(element)) {
        return;
      }

      const level = headingLevel(ctx, element);
      if (level !== undefined) {
        if (previous !== undefined && level > previous + 1) {
          ctx.warn(
            'heading-level-skipped',
            `${ctx.describe(id)} is an h${level} right after an h${previous}, so the page's outline skips a level — a screen reader or a browser agent reading it by headings finds a section missing. Make it an h${previous + 1}, and size it with its class rather than its level.`,
            id,
            { level, previous }
          );
        }

        previous = level;
      }

      (element.definition.items ?? []).forEach(walk);
    };
    walk(pageId);
  }
};

export const lintAccessibility = (ctx: LintContext): void => {
  for (const element of Object.values(ctx.flat)) {
    if (ctx.pageIds.has(element.id) || ctx.layoutIds.has(element.id)) {
      continue;
    }

    const where = ctx.describe(element.id);
    // An illustration is skipped by the readers these rules are for: nothing in it is theirs to name or press.
    if (inIllustration(ctx, element.id)) {
      warnControlInIllustration(ctx, element, where);
      continue;
    }

    warnUnnamedControl(ctx, element, where);
    warnImageWithoutAlt(ctx, element, where);
    warnEmbedWithoutTitle(ctx, element, where);
    warnClickOnStaticElement(ctx, element, where);
    warnIgnoredRegionName(ctx, element, where);
    warnDropdownWithoutControl(ctx, element, where);
  }

  warnSkippedHeadings(ctx);
};
