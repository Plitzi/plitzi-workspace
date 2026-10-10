import path from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';

type Declarations = Record<string, string>;
type DeclaredBlock = { default?: Record<string, string | number> };
type DeclaredStyle = Record<string, DeclaredBlock>;
type DeclaredDefaults = { style: DeclaredStyle; subTypes?: Record<string, { style: DeclaredStyle }> };
/** The rules each slot of an element is drawn by, for one of its sub-types (`undefined`: the element's own). */
type SlotRules = (subType: string | undefined) => Record<string, string[]>;

const css = compileString('@use "elements"; @include elements.styles;', {
  loadPaths: [path.dirname(fileURLToPath(import.meta.url))]
}).css;

// `0px` and `0` are one length, and a font family the same with or without quotes. Colours need no help: both sides
// are read back from Sass, which writes `oklch(0.21 …)` and `oklch(21% …)` the same way.
const normalise = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/['"]/g, '')
    .replace(/(^|[\s(,])0px\b/g, '$10')
    .trim();

const declarationsOf = (rule: postcss.Rule): Declarations => {
  const declarations: Declarations = {};
  rule.each(child => {
    if (child.type === 'decl') {
      declarations[child.prop] = normalise(child.value);
    }
  });

  return declarations;
};

/** Every top-level rule of the stylesheet, by selector: what an element renders with before any class of its own. */
const rulesBySelector = (() => {
  const rules = new Map<string, Declarations>();
  postcss.parse(css).each(node => {
    if (node.type !== 'rule') {
      return;
    }

    for (const selector of node.selectors) {
      rules.set(selector, { ...rules.get(selector), ...declarationsOf(node) });
    }
  });

  return rules;
})();

const ofRules = (selectors: string[]): Declarations =>
  Object.assign({}, ...selectors.map(selector => rulesBySelector.get(selector) ?? {})) as Declarations;

/** A declared block, written out and read back through Sass as the stylesheet is, so both say a value the same way. */
const ofBlock = (block: DeclaredBlock | undefined): Declarations => {
  const body = Object.entries(block?.default ?? {})
    .map(([property, value]) => `${property}: ${String(value)};`)
    .join(' ');
  const rule = postcss.parse(compileString(`.declared { ${body} }`).css).first;

  return rule?.type === 'rule' ? declarationsOf(rule) : {};
};

const root =
  (className: string, slots: Record<string, string[]> = {}): SlotRules =>
  () => ({ base: [className], ...slots });

const FORM_CONTROL_INPUTS: Record<string, string> = {
  textarea: '.form-control__textarea-container',
  select: '.form-control__select-container',
  checkbox: '.form-control__checkbox-container',
  switch: '.form-control__switch-container',
  hidden: '.form-control__input-hidden-container'
};

/** The field inside a form control's box, for the sub-types drawn as a box around one. */
const FORM_CONTROL_FIELDS: Partial<Record<string, string>> = {
  ...Object.fromEntries(
    ['text', 'number', 'email', 'password', 'search', 'url', 'tel', 'date', 'time', 'color'].map(subType => [
      subType,
      '.input-container__input'
    ])
  ),
  select: '.select-container__select'
};

/**
 * Where the stylesheet writes each element's defaults, slot by slot.
 *
 * The declaration's `defaultStyle` is what the style inspector shows a class inheriting and what the MCP tells an
 * agent an element starts from; the stylesheet is what the SDK renders. Every element is listed — a new one fails here
 * until it says where its defaults live.
 */
const STYLESHEET: Record<string, SlotRules> = {
  apiContainer: root('.plitzi-component__api-container'),
  blockHtml: root('.plitzi-component__block-html'),
  blockJsx: root('.plitzi-component__block-jsx'),
  button: root('.plitzi-component__button', { icon: [] }),
  carousel: root('.plitzi-component__carousel'),
  carouselTrack: root('.plitzi-component__carousel-track'),
  channel: root('.plitzi-component__channel'),
  container: root('.plitzi-component__container'),
  custom: root('.plitzi-component__custom'),
  dialogContainer: root('.plitzi-component__dialog-container', {
    backgroundContainer: ['.dialog-container__background'],
    rootContainer: ['.dialog-container__root'],
    headerContainer: ['.dialog-container__header'],
    headerTitle: ['.dialog-container__header__title'],
    headerCloseButton: ['.dialog-container__header .dialog-container__close'],
    bodyContainer: ['.dialog-container__body'],
    footerContainer: ['.dialog-container__footer'],
    acceptButton: ['.dialog-container__footer .footer__button'],
    // The second of the two, always: the rule for every button after the first is its own.
    cancelButton: [
      '.dialog-container__footer .footer__button',
      '.dialog-container__footer .footer__button:not(:first-child)'
    ]
  }),
  dropdown: root('.plitzi-component__dropdown', {
    backgroundContainer: ['.plitzi-component__dropdown__background-container']
  }),
  dropdownPopup: root('.plitzi-component__dropdown-popup'),
  embed: root('.plitzi-component__embed'),
  fontAwesome: () => ({
    base: ['.plitzi-component__fontawesome', '.plitzi-component__fontawesome:not(.fa-2x):not(.fa-3x):not(.fa-4x)']
  }),
  form: root('.plitzi-component__form'),
  formControl: (subType): Record<string, string[]> => {
    if (subType === undefined) {
      return { base: ['.plitzi-component__form-control'] };
    }

    return {
      base: ['.plitzi-component__form-control'],
      label: [`.form-control__label-${subType}`],
      requiredMark: ['.form-control__label--required'],
      input: [FORM_CONTROL_INPUTS[subType] ?? '.form-control__input-container'],
      ...(FORM_CONTROL_FIELDS[subType] ? { field: [FORM_CONTROL_FIELDS[subType]] } : {}),
      ...(subType === 'password' ? { icon: ['.form-input__icon'] } : {}),
      error: ['.form-control__error-message']
    };
  },
  heading: subType => ({
    base: ['.plitzi-component__heading', ...(subType ? [`.plitzi-component__heading-${subType}`] : [])]
  }),
  image: root('.plitzi-component__image'),
  layoutContainer: root('.plitzi-component__layout-container'),
  link: root('.plitzi-component__link', { icon: [] }),
  list: root('.plitzi-component__list'),
  listItem: root('.plitzi-component__list-item'),
  loading: root('.plitzi-component__loading'),
  markdown: root('.plitzi-component__markdown'),
  modalContainer: root('.plitzi-component__modal-container', {
    backgroundContainer: ['.modal-container__background'],
    rootContainer: ['.modal-container__root'],
    headerContainer: ['.modal-container__header'],
    headerTitle: ['.modal-container__header__title'],
    headerCloseButton: ['.modal-container__header .modal-container__close'],
    bodyContainer: ['.modal-container__body']
  }),
  nodeHtml: subType => ({
    base: ['.plitzi-component__node-html', ...(subType ? [`.plitzi-component__node-html-${subType}`] : [])]
  }),
  notFound: root('.plitzi-component__not-found'),
  page: root('.plitzi-component__page'),
  pagination: root('.plitzi-component__pagination'),
  paragraph: root('.plitzi-component__paragraph'),
  plitziSdk: root('.plitzi-component__plitzi-sdk'),
  reference: root('.plitzi-component__reference'),
  richText: root('.plitzi-component__rich-text'),
  svg: root('.plitzi-component__svg'),
  tabContainer: root('.plitzi-component__tab-container'),
  tabContainerBody: root('.plitzi-component__tab-container-body'),
  tabContainerHeader: root('.plitzi-component__tab-container-header'),
  // Its `display` is whether its tab is the chosen one (`.active`), not a default a class restyles.
  tabContainerItem: () => ({ base: [] }),
  text: root('.plitzi-component__text'),
  themeToggle: root('.plitzi-component__theme-toggle', {
    icon: ['.plitzi-component__theme-toggle-icon'],
    option: ['.plitzi-component__theme-toggle-option']
  }),
  video: root('.plitzi-component__video')
};

/** One-class rules of the stylesheet that are no slot's default — the parts inside a slot, and the states of one. */
const NOT_A_SLOT = new Set([
  '.carousel__slide',
  '.carousel__slide--slide-next',
  '.carousel__slide--slide-previous',
  '.carousel__slide--fade-next',
  '.carousel__slide--fade-previous',
  '.carousel__slide--empty',
  '.carousel__scroller',
  '.carousel__marquee',
  // A list in its controlled mode: the declaration's sub-types describe the `ul`/`ol` it otherwise is.
  '.plitzi-component__controlled-list',
  '.plitzi-component__tab-container-item',
  // The builder's stand-in for a field that has nothing to show on a page.
  '.input-container__input-hidden--no-preview'
]);

/** An element's slots and their rules — none for a type the table does not list, which the first test reports. */
const slotsOf = (type: string, subType: string | undefined): Record<string, string[]> =>
  Object.hasOwn(STYLESHEET, type) ? STYLESHEET[type](subType) : {};

const checks = Object.values(elementDeclarations).flatMap(declaration => {
  const { type } = declaration;
  const defaults: DeclaredDefaults = declaration.content.defaultStyle;
  const own = { name: type, type, subType: undefined, style: defaults.style };
  const subTypes = Object.entries(defaults.subTypes ?? {}).map(([subType, { style }]) => ({
    name: `${type} (${subType})`,
    type,
    subType,
    style
  }));

  return [own, ...subTypes];
});

describe('element defaults', () => {
  it('lists every element where its defaults are written', () => {
    expect(
      Object.values(elementDeclarations)
        .map(({ type }) => type)
        .filter(type => !(type in STYLESHEET))
    ).toEqual([]);
  });

  it.each(checks)('$name: the defaults it declares are the ones the stylesheet renders', check => {
    const slots = slotsOf(check.type, check.subType);
    const names = new Set([...Object.keys(slots), ...Object.keys(check.style)]);
    const declared = Object.fromEntries([...names].map(slot => [slot, ofBlock(check.style[slot])]));
    const rendered = Object.fromEntries([...names].map(slot => [slot, ofRules(slots[slot] ?? [])]));

    expect(declared).toEqual(rendered);
  });

  it('declares every one-class rule of the stylesheet as the default of some slot, or says why not', () => {
    const claimed = new Set(checks.flatMap(check => Object.values(slotsOf(check.type, check.subType)).flat()));
    const unclaimed = [...rulesBySelector.keys()].filter(
      selector => /^\.[\w-]+$/.test(selector) && !claimed.has(selector) && !NOT_A_SLOT.has(selector)
    );

    expect(unclaimed).toEqual([]);
  });

  /** A fixed height beat a class that set only a width and an `aspect-ratio`, and drew a 140px square instead. */
  it('sizes an image by its width and its own ratio, and lets the builder show it the way the page will', () => {
    expect(rulesBySelector.get('.plitzi-component__image')).toMatchObject({ width: '140px', height: 'auto' });
    expect(rulesBySelector.get('.plitzi-component__image.image--edit-mode > img')).toMatchObject({
      'object-fit': 'inherit'
    });
  });
});
