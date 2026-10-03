import { makeId } from '@plitzi/sdk-shared/helpers/utils';
import { DISPLAY_MODES, DISPLAY_MODE_MIN_WIDTH, displayModeWidthRem, isDisplayMode } from '@plitzi/sdk-shared/style';
import { styleVariablesToCss } from '@plitzi/sdk-variables/VariablesHelper';

import type { DisplayMode, Style, TagType, StyleVariables } from '@plitzi/sdk-shared';

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
          return `.${tag.value}`;
        case 'element':
          return tag.value;
        case 'id':
          return `#${tag.value}`;
        default:
          return '';
      }
    });

  return value.join(separator);
};

const defaultWidth: Record<string, string> = Object.fromEntries(
  DISPLAY_MODES.map(displayMode => [displayMode, displayModeWidthRem(displayMode)])
);

const toPx = (key: string): number => {
  if (isDisplayMode(key)) {
    return DISPLAY_MODE_MIN_WIDTH[key];
  }

  const match = key.match(/(\d*\.?\d+)(px|rem)/);
  if (!match) {
    return 0;
  }

  const value = parseFloat(match[1]);
  const unit = match[2];

  return unit === 'rem' ? value * 16 : value;
};

export const generateCache = (style: Style) => {
  const { platform, mode = 'desktop-first', variables } = style;
  const cache: string[] = [];

  const orderedKeys = Object.keys(platform).sort((a, b) =>
    mode === 'mobile-first' ? toPx(a) - toPx(b) : toPx(b) - toPx(a)
  ) as DisplayMode[];

  orderedKeys.forEach((displayMode, i) => {
    const styleBlock = Object.values(platform[displayMode])
      .sort((a, b) => Number(b.type === 'element') - Number(a.type === 'element'))
      .map(s => s.cache)
      .join('\n');
    if (!styleBlock) {
      return;
    }

    const width = defaultWidth[displayMode] ?? displayMode;

    if (mode === 'mobile-first') {
      if (width === '0' || displayMode === 'mobile') {
        cache.push(styleBlock);
      } else {
        cache.push(`@media (min-width: ${width}) {${styleBlock}}`);
      }
    } else {
      const prevKey = orderedKeys[i - 1] as DisplayMode | undefined;
      const nextWidth = prevKey ? (defaultWidth[prevKey] ?? prevKey) : undefined;

      if (displayMode === 'desktop') {
        cache.push(styleBlock);
      } else if (nextWidth) {
        cache.push(`@media (max-width: ${nextWidth}) and (min-width: ${width}) {${styleBlock}}`);
      } else {
        cache.push(`@media (max-width: ${width}) {${styleBlock}}`);
      }
    }
  });

  if ((variables as StyleVariables | undefined) && Object.keys(variables).length) {
    cache.push(styleVariablesToCss(variables));
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
