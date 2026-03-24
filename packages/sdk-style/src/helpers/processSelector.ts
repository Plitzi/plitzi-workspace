import processSelectorAttributes from './processSelectorAttributes';
import processSelectorName from './processSelectorName';
import processSelectorVariables from './processSelectorVariables';

import type { StyleItem, StyleState } from '@plitzi/sdk-shared';

const TAB_SIZE = 2;

type SelectorVariables = { default: string[]; light: string[]; dark: string[] };

const getSpaces = (tabIndentSpace = TAB_SIZE) => ' '.repeat(tabIndentSpace);

const combine = (base: string, media: string[], inline: boolean) => {
  return `${inline || !media.length ? base : `${base}\n`}${media.join(inline ? '' : '\n')}`;
};

const getMediaQueries = (
  name: string,
  selectorVariables: SelectorVariables,
  inline = true,
  tabIndentSpace = TAB_SIZE
) => {
  const extraCss: string[] = [];
  const separator = getSpaces(tabIndentSpace);
  const separatorMedia = getSpaces(tabIndentSpace + tabIndentSpace);
  if (selectorVariables.light.length > 0 && inline) {
    extraCss.push(`@media(prefers-color-scheme:light){${name}{${selectorVariables.light.join('')}}}`);
  } else if (selectorVariables.light.length > 0 && !inline) {
    const bodyLight = selectorVariables.light
      .map(variable => `${separatorMedia}${variable}`)
      .join('\n')
      .replaceAll(':', ': ');
    extraCss.push(`\n@media(prefers-color-scheme: light) {\n${separator}${name} {\n${bodyLight}\n${separator}}\n}`);
  }

  if (selectorVariables.dark.length > 0 && inline) {
    extraCss.push(`@media(prefers-color-scheme:dark){${name}{${selectorVariables.dark.join('')}}}`);
  } else if (selectorVariables.dark.length > 0 && !inline) {
    const bodyDark = selectorVariables.dark
      .map(variable => `${separatorMedia}${variable}`)
      .join('\n')
      .replaceAll(':', ': ');
    extraCss.push(`\n@media(prefers-color-scheme: dark) {\n${separator}${name} {\n${bodyDark}\n${separator}}\n}`);
  }

  return extraCss;
};

const attributesToString = (
  attributes: string[],
  stateAttributes: Record<StyleState, string[]> | Record<StyleState, Record<string, string[]>> | undefined,
  inline = false,
  tabIndentSpace = TAB_SIZE
) => {
  let state = '';
  if (stateAttributes) {
    state = parseState(stateAttributes, inline, tabIndentSpace);
  }

  let body = '';
  if (inline) {
    body = attributes.join('');
  } else {
    const separator = getSpaces(tabIndentSpace + TAB_SIZE);
    body = attributes
      .map(attribute => `${separator}${attribute}`)
      .join('\n')
      .replaceAll(':', ': ');
  }

  if (!state) {
    return body;
  }

  if (inline) {
    return `${body}${state}`;
  }

  return `${body}\n\n${state}`;
};

const parseState = (
  stateAttributes: Record<StyleState, string[]> | Record<StyleState, Record<string, string[]>>,
  inline = true,
  tabIndentSpace = TAB_SIZE
) => {
  const states: string[] = [];
  for (const [state, attributes] of Object.entries<string[]>(stateAttributes as Record<StyleState, string[]>)) {
    states.push(getSelector(`&:${state}`, attributes, undefined, inline, tabIndentSpace + TAB_SIZE));
  }

  return states.join(inline ? '' : '\n\n');
};

const getSelector = (
  name: string,
  attributes: string[],
  stateAttributes: Record<StyleState, string[]> | undefined,
  inline = true,
  tabIndentSpace = TAB_SIZE
) => {
  const body = attributesToString(attributes, stateAttributes, inline, tabIndentSpace);
  if (inline) {
    return `${name}{${body}}`;
  }

  const separator = getSpaces(tabIndentSpace);

  return `${separator}${name} {\n${body}\n${separator}}`;
};

const getBaseSelectorElement = (
  name: string,
  attributes: Record<string, string[]>,
  stateAttributes: Partial<Record<string, Record<StyleState, string[]>>> | undefined,
  inline = true,
  tabIndentSpace = TAB_SIZE
) => {
  const parts = Object.entries(attributes).map(([styleSelector, attrs]) => {
    if (styleSelector === 'base') {
      return attributesToString(attrs, stateAttributes?.[styleSelector], inline, tabIndentSpace);
    }

    const selectorName = `${name}-${styleSelector}`;

    return getSelector(selectorName, attrs, stateAttributes?.[styleSelector], inline, tabIndentSpace + TAB_SIZE);
  });

  return inline ? `${name}{${parts.join('')}}` : `${name} {\n${parts.join('\n\n')}\n}`;
};

const processSelector = (selector: StyleItem, inline = true) => {
  const name = processSelectorName(selector);
  const selectorVariables = processSelectorVariables(selector);
  let mediaQueries: string[] | undefined = undefined;
  if (selectorVariables) {
    mediaQueries = getMediaQueries(name, selectorVariables, inline);
  }

  let base: string = '';
  if (selector.type === 'element') {
    const { attributes, stateAttributes } = processSelectorAttributes(selector);
    if (selectorVariables) {
      attributes.base.push(...selectorVariables.default);
    }

    base = getBaseSelectorElement(name, attributes, stateAttributes, inline, 0);
  } else {
    const { attributes, stateAttributes } = processSelectorAttributes(selector);
    if (selectorVariables) {
      attributes.push(...selectorVariables.default);
    }

    base = getSelector(name, attributes, stateAttributes, inline, 0);
  }

  if (!mediaQueries) {
    return base;
  }

  return combine(base, mediaQueries, inline);
};

export const processSelectors = (selectors: StyleItem[], inline = false) => {
  return selectors.map(selector => processSelector(selector, inline));
};

export default processSelector;
