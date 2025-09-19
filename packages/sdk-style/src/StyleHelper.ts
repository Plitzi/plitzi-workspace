import { makeId } from '@plitzi/sdk-shared/helpers/utils';

import type { DisplayMode, StyleItem, Style, TagType, StyleValue } from '@plitzi/sdk-shared';

export type StyleHelperMetaData = {
  tree: {
    name: string;
    displayMode: DisplayMode;
    style: StyleItem['attributes'];
    isParent: boolean;
    isSubParent: boolean;
  }[];
  style: { [key: string]: { key: string; value: StyleValue; displayMode: DisplayMode }[] };
  parentStyle: { [key: string]: string };
};

export const EMPTY_STYLE_SCHEMA: Style = {
  variables: {},
  platform: { desktop: {}, tablet: {}, mobile: {} },
  cache: ''
};

export const selectorToString = (
  tags?: { type: TagType; value: string }[],
  filters: string[] = [],
  includePrefix = true,
  separator = ''
) => {
  if (!tags || tags.length === 0) {
    return '';
  }

  let value = [];
  value = tags
    .filter(tag => filters.length === 0 || filters.includes(tag.type))
    .map(tag => {
      if (!includePrefix) {
        return tag.value;
      }

      switch (tag.type) {
        case 'class':
        case 'state':
          return `.${tag.value}`;
        case 'element':
        case 'parent':
          return tag.value;
        case 'id':
          return `#${tag.value}`;
        default:
          return '';
      }
    });

  return value.join(separator);
};

export const generateCache = (style: Style) => {
  const { platform } = style;
  const cache = [];
  if (Object.keys(platform.desktop).length > 0) {
    const style = Object.values(platform.desktop)
      .map(s => s.cache)
      .join('\n');
    if (style !== '') {
      cache.push(style);
    }
  }

  if (Object.keys(platform.tablet).length > 0) {
    const style = Object.values(platform.tablet)
      .map(s => s.cache)
      .join('\n');
    if (style !== '') {
      cache.push(`@media screen and (max-width: 768px) {${style}}`);
    }
  }

  if (Object.keys(platform.mobile).length > 0) {
    const style = Object.values(platform.mobile)
      .map(s => s.cache)
      .join('\n');
    if (style !== '') {
      cache.push(`@media screen and (max-width: 425px) {${style}}`);
    }
  }

  return cache.join('\n');
};

export const makeSelector = (type: string, styleSelector = 'base', length = 4) => {
  let selector = `${type}-${makeId(length)}`;
  if (styleSelector !== 'base') {
    selector = `${type}-${styleSelector}-${makeId(length)}`;
  }

  return selector;
};
