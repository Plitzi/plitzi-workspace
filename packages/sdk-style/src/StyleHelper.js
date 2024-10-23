// Packages
import get from 'lodash/get.js';
import pick from 'lodash/pick.js';
import set from 'lodash/set.js';

// Monorepo
import { makeId } from '@plitzi/sdk-shared/utils';

// Relatives
import { StyleConstants, inheritableAttributesBase } from './StyleConstants.js';

export const StyleSelectors = {
  SELECTOR_CLASS: 'class',
  SELECTOR_ELEMENT: 'element',
  SELECTOR_ID: 'id',
  SELECTOR_STATE: 'state',
  SELECTOR_PARENT: 'parent'
};

export const processSelector = (selector, type, attributes) => {
  const result = [];
  Object.keys(attributes).forEach(key => {
    result.push(`${key}:${attributes[key]};`);
  });

  let finalSelector = selector;
  switch (type) {
    case StyleSelectors.SELECTOR_CLASS:
    case StyleSelectors.SELECTOR_STATE:
      finalSelector = `.${selector}`;
      break;

    case StyleSelectors.SELECTOR_ID:
      finalSelector = `#${selector}`;
      break;

    case StyleSelectors.SELECTOR_ELEMENT:
    case StyleSelectors.SELECTOR_PARENT:
    default:
  }

  return `${finalSelector}{${result.join('')}}`;
};

export const selectorToString = (tags, filters = [], includePrefix = true, separator = '') => {
  if (!tags || tags.length === 0) {
    return '';
  }

  let value = '';
  value = tags
    .filter(tag => filters.length === 0 || filters.includes(tag.type))
    .map(tag => {
      if (!includePrefix) {
        return tag.value;
      }

      switch (tag.type) {
        case StyleSelectors.SELECTOR_CLASS:
        case StyleSelectors.SELECTOR_STATE:
          return `.${tag.value}`;
        case StyleSelectors.SELECTOR_ELEMENT:
        case StyleSelectors.SELECTOR_PARENT:
          return tag.value;
        case StyleSelectors.SELECTOR_ID:
          return `#${tag.value}`;
        default:
          return '';
      }
    });

  return value.join(separator);
};

const getDataStyle = (
  element,
  platform,
  styleSelector = 'base',
  isParent = false,
  isSubParent = false,
  componentDefinitions = {}
) => {
  const metadata = { tree: [] };
  if (!element) {
    return undefined;
  }

  const {
    attributes: { subType },
    definition: { type, styleSelectors }
  } = element;

  // get element display mode styles (mobile -> tablet -> desktop)
  ['desktop', 'tablet', 'mobile'].forEach(mode => {
    const selectorSegments = Object.values(
      pick(get(platform, mode, {}), get(styleSelectors, styleSelector, '').split(' '))
    );
    selectorSegments.forEach(segment => {
      const { name } = segment;
      const style = platform[mode][name];
      if (style) {
        metadata.tree.push({ name, displayMode: mode, style: style.attributes, isParent, isSubParent });
      }
    });

    // global native type
    if (type && platform[mode][type] && platform[mode][type].type !== 'class') {
      metadata.tree.push({
        name: type,
        displayMode: mode,
        style: platform[mode][type].attributes,
        isParent,
        isSubParent
      });
    } else if (subType && platform[mode][subType] && platform[mode][subType].type !== 'class') {
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
  let global = get(componentDefinitions, `${type}.defaultStyle`);
  if (global && subType) {
    const subGlobal = global.subTypes[subType];
    if (subGlobal) {
      global = subGlobal;
    }
  }

  if (global) {
    metadata.tree.push({ ...global, style: get(global, `style.${styleSelector}`, {}), isParent, isSubParent });
  }

  return metadata;
};

export const calculateInheriting = (
  element,
  flat,
  platform,
  styleSelector,
  componentDefinitions,
  skipSelectors = []
) => {
  const metadata = { tree: [], style: {}, parentStyle: {} };
  if (!element) {
    return metadata;
  }

  const { id } = element;
  const parentId = get(element, 'definition.parentId');
  while (element) {
    const styleData = getDataStyle(
      element,
      platform,
      styleSelector,
      element.id === parentId,
      id !== element.id,
      componentDefinitions
    );
    metadata.tree.push(
      ...styleData.tree.filter(node => !skipSelectors || !(skipSelectors.includes(node.name) && !node.isSubParent))
    );
    element = get(flat, get(element, 'definition.parentId'));
  }

  const finalMeta = {};
  metadata.tree.forEach(node => {
    let styleData = get(node, `style.${styleSelector}`, node.style);
    if (!styleData) {
      return;
    }

    if (node.isSubParent) {
      styleData = pick(styleData, inheritableAttributesBase);
    }

    Object.keys(styleData)
      .filter(key => (inheritableAttributesBase.includes(key) && node.isSubParent) || !node.isSubParent)
      .forEach(key => {
        if (!finalMeta[key]) {
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
  };
};

export const calculateBindings = element => {
  const metadata = { tree: [], style: {} };
  if (!element) {
    return metadata;
  }

  const {
    definition: { bindings }
  } = element;

  if (!bindings || !bindings.style) {
    return metadata;
  }

  Object.keys(bindings.style).forEach(styleKey => {
    set(metadata.style, styleKey, true);
  });

  return metadata;
};

export const generateCache = style => {
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

export const cssToSelectors = (css = '', singleSelector = false) => {
  const match = [...css.replaceAll('\n', '').matchAll(cssRegex)];
  const selectors = match.map(match => {
    const { selectorName, selectorData } = match.groups;
    const selectorResult = { name: selectorName?.trim(), attributes: {}, cache: match[0] };
    if (selectorData) {
      const propsMatch = [...selectorData.replaceAll(cssIsCommentRegex, '').trim().matchAll(cssPropsRegex)];
      propsMatch
        .filter(prop => StyleConstantsList.includes(prop.groups.propName))
        .forEach(prop => {
          const { propName, propValue } = prop.groups;
          set(selectorResult, `attributes.${propName.trim()}`, `${propValue.trim()}`);
        });
    }

    return selectorResult;
  });

  if (singleSelector && Array.isArray(selectors) && selectors.length > 0) {
    return selectors[0];
  }

  return selectors;
};

export const getReadOnlyRangesFromContent = (css = '', allowPre = true, allowAfter = true) => {
  const ranges = [];
  [...css.matchAll(cssRegex)].forEach(match => {
    const { selector, selectorName, selectorData } = match.groups;
    const selectorNameCorrection = [...(selectorName?.match(/[\n]/gim) ?? [])].length;
    const bFrom = allowPre ? match.index : 0;
    const bTo = bFrom + selector.length + selectorName.length + 1 - selectorNameCorrection;
    const aFrom = bTo + selectorData.length;
    const aTo = allowAfter ? aFrom + 1 : undefined;
    ranges.push({ from: bFrom, to: bTo }, { from: aFrom, to: aTo });
  });

  return ranges;
};

export const formatCssFromSelector = (css, singleSelector = true, tabIndentSpace = 2, filterProps = true) => {
  const match = [...css.replaceAll('\n', '').matchAll(cssRegex)];
  const selectors = match.map(match => {
    const { selector, selectorName, selectorData } = match.groups;
    if (!selectorData) {
      return `${selector}${selectorName} {\n}`;
    }

    const propsMatch = [...selectorData.matchAll(cssPropsRegex)];
    let propsString = '';
    propsMatch
      .filter(prop => !filterProps || StyleConstantsList.includes(prop.groups.propName))
      .forEach(prop => {
        const { propName, propValue } = prop.groups;
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

export const generateStyleSelector = (selector = '', selectorType = StyleSelectors.SELECTOR_CLASS, values = {}) => {
  if (!selector || !values || typeof values !== 'object') {
    return undefined;
  }

  return {
    name: selector,
    type: selectorType,
    attributes: values,
    cache: processSelector(selector, selectorType, values)
  };
};

export const makeSelector = (type, styleSelector = 'base', length = 4) => {
  let selector = `${type}-${makeId(length)}`;
  if (styleSelector !== 'base') {
    selector = `${type}-${styleSelector}-${makeId(length)}`;
  }

  return selector;
};
