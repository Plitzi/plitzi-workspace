import processSelectorAttributes from './processSelectorAttributes';
import processSelectorName from './processSelectorName';
import processSelectorVariables from './processSelectorVariables';

import type { StyleItem, StyleState } from '@plitzi/sdk-shared';

const TAB_SIZE = 2;

const getSpaces = (n = TAB_SIZE) => ' '.repeat(n);

type Attributes = Record<
  string,
  {
    default: string[];
    states?: Record<StyleState, string[]>;
    variants?: Record<string, { default: string[]; states?: Record<StyleState, string[]> }>;
  }
>;

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

const attributesToString = (
  name: string,
  attrs: string[],
  states?: Attributes[string]['states'],
  variants?: Attributes[string]['variants'],
  inline = true,
  tab = TAB_SIZE
) => {
  const body = inline
    ? attrs.join('')
    : attrs
        .map(a => `${getSpaces(tab + TAB_SIZE)}${a}`)
        .join('\n')
        .replaceAll(':', ': ');

  const stateBlocks: string[] = states
    ? Object.entries(states).map(([state, values]) =>
        getSelector(`&:${state}`, values, undefined, undefined, inline, tab + TAB_SIZE)
      )
    : [];

  const variantBaseName = name.replace('plitzi__', '');
  const variantBlocks: string[] = variants
    ? Object.entries(variants).map(([variant, values]) =>
        getSelector(
          `&[data-variant="${variant}"]${inline ? ',' : ', '}&${variantBaseName}--${variant}`,
          values.default,
          values.states,
          undefined,
          inline,
          tab + TAB_SIZE
        )
      )
    : [];

  if (inline) {
    return `${body}${stateBlocks.join('')}${variantBlocks.join('')}`;
  }

  const sections = body ? [body] : [];
  if (stateBlocks.length) {
    sections.push(stateBlocks.join('\n\n'));
  }

  if (variantBlocks.length) {
    sections.push(variantBlocks.join('\n\n'));
  }

  return sections.join('\n\n');
};

const getSelector = (
  name: string,
  attrs: string[],
  states?: Attributes[string]['states'],
  variants?: Attributes[string]['variants'],
  inline = true,
  tab = TAB_SIZE
) => {
  const body = attributesToString(name, attrs, states, variants, inline, tab);

  return inline ? `${name}{${body}}` : `${getSpaces(tab)}${name} {\n${body}\n${getSpaces(tab)}}`;
};

const getElementSelector = (name: string, attributes: Attributes, inline = true, tab = TAB_SIZE) => {
  const parts: string[] = [];
  for (const [styleSelector, block] of Object.entries(attributes)) {
    // Base selector - inline in the root
    if (styleSelector === 'base') {
      const content = attributesToString(name, block.default, block.states, block.variants, inline, tab);
      if (content) {
        parts.push(content);
      }

      continue;
    }

    // Sub Selectors
    parts.push(
      getSelector(`${name}-${styleSelector}`, block.default, block.states, block.variants, inline, tab + TAB_SIZE)
    );
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
