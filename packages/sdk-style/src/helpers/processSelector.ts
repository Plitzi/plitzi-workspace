import processSelectorAttributes from './processSelectorAttributes';
import processSelectorName from './processSelectorName';
import processSelectorVariables from './processSelectorVariables';

import type { StyleItem } from '@plitzi/sdk-shared';

const getBaseSelector = (
  name: string,
  attributes: string[],
  inline = true,
  separator = '',
  separatorAttribute = ' '
) => {
  if (inline) {
    return `${name}{${attributes.join('')}}`;
  }

  const body = attributes
    .map(attribute => `${separatorAttribute}${attribute}`)
    .join('\n')
    .replaceAll(':', ': ');

  return `${separator}${name} {\n${body}\n${separator}}`;
};

const getBaseSelectorComponent = (
  name: string,
  attributesGroups: Record<string, string[]>,
  inline = true,
  separator = ' ',
  separatorMedia = ' '
) => {
  return `${inline ? `${name}{` : `${name} {\n`}${Object.keys(attributesGroups)
    .map(group => {
      if (group !== 'base') {
        return `${inline ? '' : '\n'}${getBaseSelector(`${name}--${group}`, attributesGroups[group], inline, separator, separatorMedia)}`;
      }

      if (inline) {
        return attributesGroups[group].join('');
      }

      return attributesGroups[group]
        .map(attribute => `${separator}${attribute}`)
        .join('\n')
        .replaceAll(':', ': ');
    })
    .join(inline ? '' : '\n')}${inline ? '}' : '\n}'}`;
};

const getMediaQueries = (
  name: string,
  variablesSelector: {
    default: string[];
    light: string[];
    dark: string[];
  },
  inline = true,
  separator = ' ',
  separatorMedia = ' '
) => {
  const extraCss: string[] = [];
  if (variablesSelector.light.length > 0 && inline) {
    extraCss.push(`@media(prefers-color-scheme:light){${name}{${variablesSelector.light.join('')}}}`);
  } else if (variablesSelector.light.length > 0 && !inline) {
    const bodyLight = variablesSelector.light
      .map(variable => `${separatorMedia}${variable}`)
      .join('\n')
      .replaceAll(':', ': ');
    extraCss.push(`\n@media(prefers-color-scheme: light) {\n${separator}${name} {\n${bodyLight}\n${separator}}\n}`);
  }

  if (variablesSelector.dark.length > 0 && inline) {
    extraCss.push(`@media(prefers-color-scheme:dark){${name}{${variablesSelector.dark.join('')}}}`);
  } else if (variablesSelector.dark.length > 0 && !inline) {
    const bodyDark = variablesSelector.dark
      .map(variable => `${separatorMedia}${variable}`)
      .join('\n')
      .replaceAll(':', ': ');
    extraCss.push(`\n@media(prefers-color-scheme: dark) {\n${separator}${name} {\n${bodyDark}\n${separator}}\n}`);
  }

  return extraCss;
};

const processSelectorDefault = (
  selector: Exclude<StyleItem, { type: 'class-component' }>,
  inline = true,
  tabIndentSpace = 2
) => {
  const separator = ' '.repeat(tabIndentSpace);
  const separatorMedia = ' '.repeat(tabIndentSpace * 2);
  const name = processSelectorName(selector);
  const attributes = processSelectorAttributes(selector);
  const variablesSelector = processSelectorVariables(selector);
  if (!variablesSelector) {
    return getBaseSelector(name, attributes, inline, '', separator);
  }

  const mediaQueries = getMediaQueries(name, variablesSelector, inline, separator, separatorMedia);
  const base = getBaseSelector(name, [...attributes, ...variablesSelector.default], inline, '', separator);

  return `${inline || !mediaQueries.length ? base : `${base}\n`}${mediaQueries.join(inline ? '' : '\n')}`;
};

const processSelectorComponent = (
  selector: Extract<StyleItem, { type: 'class-component' }>,
  inline = true,
  tabIndentSpace = 2
) => {
  const separator = ' '.repeat(tabIndentSpace);
  const separatorMedia = ' '.repeat(tabIndentSpace * 2);
  const name = processSelectorName(selector);
  const variablesSelector = processSelectorVariables(selector);
  const attributesGroups: Record<string, string[]> = Object.keys(selector.attributes).reduce(
    (acum, styleSelector) => ({ ...acum, [styleSelector]: processSelectorAttributes(selector, styleSelector) }),
    {}
  );

  if (!variablesSelector) {
    return getBaseSelectorComponent(name, attributesGroups, inline, separator, separatorMedia);
  }

  const mediaQueries = getMediaQueries(name, variablesSelector, inline, separator, separatorMedia);
  attributesGroups.base.push(...variablesSelector.default);
  const base = getBaseSelectorComponent(name, attributesGroups, inline, separator, separatorMedia);

  return `${inline || !mediaQueries.length ? base : `${base}\n`}${mediaQueries.join(inline ? '' : '\n')}`;
};

const processSelector = (selector: StyleItem, inline = true, tabIndentSpace = 2) => {
  if (selector.type === 'class-component') {
    return processSelectorComponent(selector, inline, tabIndentSpace);
  }

  return processSelectorDefault(selector, inline, tabIndentSpace);
};

export const processSelectorsMultiLine = (selectors: StyleItem[], inline = false, tabIndentSpace = 2) => {
  return selectors.map(selector => processSelector(selector, inline, tabIndentSpace));
};

export default processSelector;
