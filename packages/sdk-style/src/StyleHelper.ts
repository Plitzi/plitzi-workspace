import get from 'lodash/get';
import pick from 'lodash/pick';
import set from 'lodash/set';

import { StyleConstants, inheritableAttributesBase } from '@plitzi/sdk-shared';
import { makeId } from '@plitzi/sdk-shared/utils';

import type {
  Schema,
  Element,
  ComponentDefinition,
  DisplayMode,
  ElementBinding,
  StyleItem,
  Style,
  TagType,
  StyleValue,
  StyleCategory,
  StyleBaseItem
} from '@plitzi/sdk-shared';

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

export const processSelector = (selector: string, type?: TagType, attributes: StyleItem['attributes'] = {}) => {
  const result: string[] = [];
  Object.keys(attributes).forEach(key => {
    result.push(`${key}:${attributes[key as StyleCategory]};`);
  });

  let finalSelector = selector;
  switch (type) {
    case 'class':
    case 'state':
      finalSelector = `.${selector}`;
      break;

    case 'id':
      finalSelector = `#${selector}`;
      break;

    case 'element':
    case 'parent':
    default:
  }

  return `${finalSelector}{${result.join('')}}`;
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

const getDataStyle = (
  element: Element | undefined,
  platform: Style['platform'],
  styleSelector = 'base',
  isParent = false,
  isSubParent = false,
  componentDefinitions: { [key: string]: ComponentDefinition } = {}
) => {
  const metadata: { tree: StyleHelperMetaData['tree'] } = { tree: [] };
  if (!element) {
    return undefined;
  }

  const {
    attributes: { subType },
    definition: { type, styleSelectors }
  } = element;

  // get element display mode styles (mobile -> tablet -> desktop)
  (['desktop', 'tablet', 'mobile'] as DisplayMode[]).forEach(mode => {
    const selectorSegments = Object.values(
      pick(get(platform, mode, {}), get(styleSelectors, styleSelector, '').split(' '))
    );
    selectorSegments.forEach(segment => {
      if (!segment) {
        return;
      }

      const { name } = segment;
      const style = platform[mode][name] as StyleItem | undefined;
      if (style) {
        metadata.tree.push({ name, displayMode: mode, style: style.attributes, isParent, isSubParent });
      }
    });

    // global native type
    if (type && (platform[mode][type] as StyleItem | undefined) && platform[mode][type].type !== 'class') {
      metadata.tree.push({
        name: type,
        displayMode: mode,
        style: platform[mode][type].attributes,
        isParent,
        isSubParent
      });
    } else if (
      subType &&
      (platform[mode][subType] as StyleItem | undefined) &&
      platform[mode][subType].type !== 'class'
    ) {
      metadata.tree.push({
        name: subType,
        displayMode: mode,
        style: platform[mode][subType].attributes,
        isParent,
        isSubParent
      });
    }
  });

  // get global element type
  let global = get(componentDefinitions, `${type}.defaultStyle`) as unknown as
    | ComponentDefinition['defaultStyle']
    | undefined;
  if (global && subType) {
    const subGlobal = global.subTypes?.[subType];
    if (subGlobal) {
      global = subGlobal;
    }
  }

  if (global) {
    metadata.tree.push({
      ...global,
      style: get(global, `style.${styleSelector}`, {}) as StyleItem['attributes'],
      isParent,
      isSubParent
    });
  }

  return metadata;
};

export const calculateInheriting = (
  element: Element | undefined,
  flat: Schema['flat'],
  platform: Style['platform'],
  styleSelector?: string,
  componentDefinitions: { [key: string]: ComponentDefinition } = {},
  skipSelectors: string[] = []
) => {
  const metadata: StyleHelperMetaData = { tree: [], style: {}, parentStyle: {} };
  if (!element) {
    return metadata;
  }

  const { id } = element;
  const parentId = get(element, 'definition.parentId');
  while (element as Element | undefined) {
    const styleData = getDataStyle(
      element,
      platform,
      styleSelector,
      element.id === parentId,
      id !== element.id,
      componentDefinitions
    );
    if (styleData) {
      metadata.tree.push(...styleData.tree.filter(node => !(skipSelectors.includes(node.name) && !node.isSubParent)));
    }

    element = get(flat, get(element, 'definition.parentId', ''));
  }

  const finalMeta: StyleHelperMetaData['style'] = {};
  metadata.tree.forEach(node => {
    let styleData = get(node, `style.${styleSelector}`, node.style) as { [key: string]: string } | undefined;
    if (!styleData) {
      return;
    }

    if (node.isSubParent) {
      styleData = pick(styleData, inheritableAttributesBase);
    }

    Object.keys(styleData)
      .filter(key => (inheritableAttributesBase.includes(key) && node.isSubParent) || !node.isSubParent)
      .forEach(key => {
        if (!(finalMeta[key] as StyleHelperMetaData['style'][string] | undefined)) {
          finalMeta[key] = [];
        }

        finalMeta[key].push({ key: node.name, value: styleData[key], displayMode: node.displayMode });
      });
  });

  return {
    ...metadata,
    style: finalMeta,
    parentStyle: metadata.tree
      .filter(node => node.isParent)
      .reduce((acum, node) => ({ ...acum, ...get(node, 'style', {}) }), {})
  } as StyleHelperMetaData;
};

export const calculateBindings = (element?: Element) => {
  const metadata: { style: { [key: string]: string | number } } = { style: {} };
  if (!element) {
    return metadata;
  }

  const {
    definition: { bindings }
  } = element;

  if (!bindings || !(bindings as Record<string, ElementBinding[] | undefined>).style) {
    return metadata;
  }

  Object.keys(bindings.style).forEach(styleKey => {
    set(metadata.style, styleKey, true);
  });

  return metadata;
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

const cssRegex =
  /(?<selector>\.|#|)(?<selectorName>[a-z0-9_-]+)([ ]+|){(?<selectorData>[a-z0-9:; (),.%\n*/#+"'_-]+|)}/gim;
const cssPropsRegex = /(?<propName>[a-z-]+):([ ]+|)(?<propValue>([a-z-]+\([^;]\)|".*"|[a-z0-9 (),.%\n*/#+"':_-]+))/gim;
const cssIsCommentRegex = /(\/\*.*\*\/)/gim;
const StyleConstantsList = Object.values(StyleConstants);

export function cssToSelectors(css: string, singleSelector: true): StyleBaseItem;
export function cssToSelectors(css: string, singleSelector?: false): StyleBaseItem[];
export function cssToSelectors(css = '', singleSelector = false): StyleBaseItem | StyleBaseItem[] {
  const match = [...css.replaceAll('\n', '').matchAll(cssRegex)];
  const selectors = match.map(match => {
    const { selectorName, selectorData } = match.groups as Record<string, string | undefined>;
    const selectorResult: StyleBaseItem = { name: selectorName?.trim() ?? '', attributes: {}, cache: match[0] };
    if (selectorData) {
      const propsMatch = [...selectorData.replaceAll(cssIsCommentRegex, '').trim().matchAll(cssPropsRegex)];
      propsMatch
        .filter(prop => StyleConstantsList.includes((prop.groups as Record<string, StyleCategory>).propName))
        .forEach(prop => {
          const { propName, propValue } = prop.groups as Record<string, string>;
          set(selectorResult, `attributes.${propName.trim()}`, propValue.trim());
        });
    }

    return selectorResult;
  });

  if (singleSelector && Array.isArray(selectors) && selectors.length > 0) {
    return selectors[0];
  }

  return selectors;
}

export const getReadOnlyRangesFromContent = (css = '', allowPre = true, allowAfter = true) => {
  const ranges: { from: number | null; to: number | null }[] = [];
  [...css.matchAll(cssRegex)].forEach(match => {
    const { selector, selectorName, selectorData } = match.groups as Record<string, string | undefined>;
    if (!selectorName || !selector || !selectorData) {
      return;
    }

    const selectorNameCorrection = [...(selectorName.match(/[\n]/gim) ?? [])].length;
    const bFrom = allowPre ? match.index : 0;
    const bTo = bFrom + selector.length + selectorName.length + 1 - selectorNameCorrection;
    const aFrom = bTo + selectorData.length;
    const aTo = allowAfter ? aFrom + 1 : null;
    ranges.push({ from: bFrom, to: bTo }, { from: aFrom, to: aTo });
  });

  return ranges;
};

export const formatCssFromSelector = (css: string, singleSelector = true, tabIndentSpace = 2, filterProps = true) => {
  const match = [...css.replaceAll('\n', '').matchAll(cssRegex)];
  const selectors = match.map(match => {
    const { selector, selectorName, selectorData } = match.groups as Record<string, string>;
    if (!selectorData) {
      return `${selector}${selectorName} {\n}`;
    }

    const propsMatch = [...selectorData.matchAll(cssPropsRegex)];
    let propsString = '';
    propsMatch
      .filter(
        prop => !filterProps || StyleConstantsList.includes((prop.groups as Record<string, StyleCategory>).propName)
      )
      .forEach(prop => {
        const { propName, propValue } = prop.groups as Record<string, string>;
        if (propName && propValue) {
          propsString = `${propsString}${propsString === '' ? '' : '\n'}${' '.repeat(
            tabIndentSpace
          )}${propName}: ${propValue};`;
        } else {
          console.log('HEY', propName, propValue);
        }
      });

    return `${selector}${selectorName} {\n${propsString}\n}`;
  });

  if (singleSelector && Array.isArray(selectors) && selectors.length > 0) {
    return selectors[0];
  }

  if (selectors.length === 0) {
    return '';
  }

  return selectors;
};

export const generateStyleSelector = (
  selector = '',
  selectorType: TagType = 'class',
  values: StyleItem['attributes'] = {}
) => {
  if (!selector || typeof values !== 'object') {
    return undefined;
  }

  return {
    name: selector,
    type: selectorType,
    attributes: values,
    cache: processSelector(selector, selectorType, values)
  };
};

export const makeSelector = (type: string, styleSelector = 'base', length = 4) => {
  let selector = `${type}-${makeId(length)}`;
  if (styleSelector !== 'base') {
    selector = `${type}-${styleSelector}-${makeId(length)}`;
  }

  return selector;
};
