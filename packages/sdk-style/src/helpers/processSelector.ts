import { inCascadeOrder, isStartingState, stateSuffix } from '@plitzi/sdk-shared/style/styleStates';

import processSelectorAttributes from './processSelectorAttributes';
import processSelectorName from './processSelectorName';
import processSelectorVariables from './processSelectorVariables';

import type { Attributes, ProcessedAncestors } from './processSelectorAttributes';
import type { StyleItem } from '@plitzi/sdk-shared';

type Block = Omit<Attributes[string], 'default'>;

const TAB_SIZE = 2;

const getSpaces = (n = TAB_SIZE) => ' '.repeat(n);

const combine = (base: string, media: string[], inline: boolean) =>
  `${inline || !media.length ? base : `${base}\n`}${media.join(inline ? '' : '\n')}`;

const getMediaQueries = (
  name: string,
  variables: { default: string[]; light: string[]; dark: string[] },
  inline = true,
  tab = TAB_SIZE
) => {
  const out: string[] = [];
  const sep = getSpaces(tab);
  const sepMedia = getSpaces(tab + TAB_SIZE);

  for (const mode of ['light', 'dark'] as const) {
    if (!variables[mode].length) {
      continue;
    }

    if (inline) {
      out.push(`@media(prefers-color-scheme:${mode}){${name}{${variables[mode].join('')}}}`);
    } else {
      const body = variables[mode]
        .map(v => `${sepMedia}${v}`)
        .join('\n')
        .replaceAll(':', ': ');

      out.push(`\n@media(prefers-color-scheme: ${mode}) {\n${sep}${name} {\n${body}\n${sep}}\n}`);
    }
  }

  return out;
};

const variantSelector = (base: string, variant: string, state = '') => [
  `${base}[data-variant="${variant}"]${state}`,
  `${base}--${variant}${state}`
];

// `:where()` keeps the rule at the class's own weight: it beats the class's base, and the element's own states and
// variants still beat it.
const ancestorRules = (ancestors: ProcessedAncestors, inline: boolean, tab: number) => {
  const separator = inline ? ',' : ', ';
  const rules: string[] = [];
  for (const [ancestor, { default: values, states, variants }] of Object.entries(ancestors)) {
    if (values?.length) {
      rules.push(getSelector(`:where(.${ancestor}) &`, values, {}, inline, tab));
    }

    for (const [state, values] of inCascadeOrder(states ?? {})) {
      rules.push(getSelector(`:where(.${ancestor}${stateSuffix(state)}) &`, values, {}, inline, tab));
      if (isStartingState(state)) {
        rules.push(startingStyle(`:where(.${ancestor}) &`, values, inline, tab));
      }
    }

    for (const [variant, block] of Object.entries(variants ?? {})) {
      if (block.default.length) {
        const selector = variantSelector(`.${ancestor}`, variant).join(separator);
        rules.push(getSelector(`:where(${selector}) &`, block.default, {}, inline, tab));
      }

      for (const [state, values] of inCascadeOrder(block.states ?? {})) {
        const selector = variantSelector(`.${ancestor}`, variant, stateSuffix(state)).join(separator);
        rules.push(getSelector(`:where(${selector}) &`, values, {}, inline, tab));
        if (isStartingState(state)) {
          const shown = variantSelector(`.${ancestor}`, variant).join(separator);
          rules.push(startingStyle(`:where(${shown}) &`, values, inline, tab));
        }
      }
    }
  }

  return rules;
};

const attributesToString = (name: string, attrs: string[], block: Block, inline = true, tab = TAB_SIZE) => {
  const { states, variants, ancestors } = block;
  const body = inline
    ? attrs.join('')
    : attrs
        .map(a => `${getSpaces(tab + TAB_SIZE)}${a}`)
        .join('\n')
        .replaceAll(':', ': ');

  const stateBlocks: string[] = states
    ? inCascadeOrder(states).flatMap(([state, values]) => {
        const block = getSelector(`&${stateSuffix(state)}`, values, {}, inline, tab + TAB_SIZE);

        return isStartingState(state) ? [block, startingStyle('&', values, inline, tab + TAB_SIZE)] : [block];
      })
    : [];

  const variantBaseName = name.replace('plitzi__', '');
  const variantBlocks: string[] = variants
    ? Object.entries(variants).map(([variant, values]) =>
        getSelector(
          `&[data-variant="${variant}"]${inline ? ',' : ', '}&${variantBaseName}--${variant}`,
          values.default,
          { states: values.states },
          inline,
          tab + TAB_SIZE
        )
      )
    : [];

  const ancestorBlocks = ancestors ? ancestorRules(ancestors, inline, tab + TAB_SIZE) : [];

  if (inline) {
    return `${body}${stateBlocks.join('')}${variantBlocks.join('')}${ancestorBlocks.join('')}`;
  }

  const sections = body ? [body] : [];
  for (const blocks of [stateBlocks, variantBlocks, ancestorBlocks]) {
    if (blocks.length) {
      sections.push(blocks.join('\n\n'));
    }
  }

  return sections.join('\n\n');
};

// Where the selector starts from as it appears — from `display: none`, or on its first paint — for its transition to
// run from: the rules of a state that is also a starting point (`hidden`), nested so they keep the selector's weight.
const startingStyle = (selector: string, values: string[], inline: boolean, tab: number) =>
  inline
    ? `@starting-style{${getSelector(selector, values, {}, inline, tab)}}`
    : `${getSpaces(tab)}@starting-style {\n${getSelector(selector, values, {}, inline, tab + TAB_SIZE)}\n${getSpaces(tab)}}`;

const getSelector = (name: string, attrs: string[], block: Block, inline = true, tab = TAB_SIZE) => {
  const body = attributesToString(name, attrs, block, inline, tab);

  return inline ? `${name}{${body}}` : `${getSpaces(tab)}${name} {\n${body}\n${getSpaces(tab)}}`;
};

const getElementSelector = (name: string, attributes: Attributes, inline = true, tab = TAB_SIZE) => {
  const parts: string[] = [];
  for (const [styleSelector, block] of Object.entries(attributes)) {
    // Base selector - inline in the root
    if (styleSelector === 'base') {
      const content = attributesToString(name, block.default, block, inline, tab);
      if (content) {
        parts.push(content);
      }

      continue;
    }

    // Sub Selectors
    parts.push(getSelector(`${name}-${styleSelector}`, block.default, block, inline, tab + TAB_SIZE));
  }

  return inline ? `${name}{${parts.join('')}}` : `${name} {\n${parts.join('\n\n')}\n}`;
};

const processSelector = (selector: StyleItem, inline = true) => {
  const name = processSelectorName(selector);
  const vars = processSelectorVariables(selector);

  const processed = processSelectorAttributes(selector);
  const media = vars ? getMediaQueries(name, vars, inline) : undefined;
  if (vars) {
    processed.attributes.base.default.push(...vars.default);
  }

  const css = getElementSelector(name, processed.attributes, inline, 0);

  return media ? combine(css, media, inline) : css;
};

export const processSelectors = (selectors: StyleItem[], inline = false) => {
  return selectors.map(selector => processSelector(selector, inline));
};

export default processSelector;
