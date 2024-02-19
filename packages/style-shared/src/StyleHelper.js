// Packages
import get from 'lodash/get';
import pick from 'lodash/pick';
import set from 'lodash/set';

// Monorepo
import { makeId } from '@plitzi/sdk-shared/utils';

// Relatives
import { StyleConstants, inheritableAttributesBase } from './StyleConstants';

export const StyleSelectors = {
  SELECTOR_CLASS: 'class',
  SELECTOR_ELEMENT: 'element',
  SELECTOR_ID: 'id',
  SELECTOR_STATE: 'state',
  SELECTOR_PARENT: 'parent'
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
          return `.${tag.value}`;
        case StyleSelectors.SELECTOR_ELEMENT:
        case StyleSelectors.SELECTOR_PARENT:
          return tag.value;
        case StyleSelectors.SELECTOR_ID:
          return `#${tag.value}`;
        case StyleSelectors.SELECTOR_STATE:
          return `:${tag.value}`;
        default:
          return '';
      }
    });

  return value.join(separator);
};

export const stringToSelector = value => {
  const parser = /([.:#]?)([a-z0-9\-_]+)/gim;
  const values = [];
  if (typeof value !== 'string') {
    return values;
  }

  const segments = value.split(' ');
  value = segments.pop();
  if (segments.length > 0) {
    segments.forEach(segment => {
      return values.push({ type: StyleSelectors.SELECTOR_PARENT, value: segment });
    });
  }

  let match = parser.exec(value);
  while (match) {
    switch (match[1]) {
      case '.':
        values.push({ type: StyleSelectors.SELECTOR_CLASS, value: match[2] });

        break;

      case '#':
        values.push({ type: StyleSelectors.SELECTOR_ID, value: match[2] });

        break;

      case ':':
        values.push({ type: StyleSelectors.SELECTOR_STATE, value: match[2] });

        break;

      case '':
        values.push({ type: StyleSelectors.SELECTOR_ELEMENT, value: match[2] });

        break;

      default:
    }

    match = parser.exec(value);
  }

  return values;
};

export const classStringFilter = (value, filters = [], includePrefix = true, separator = '') => {
  value = stringToSelector(value);

  return selectorToString(value, filters, includePrefix, separator);
};

export const processSelector = selector => {
  const result = [];
  Object.keys(selector).forEach(key => {
    result.push(`${key}:${selector[key]};`);
  });

  return result.join('');
};

const getDataStyle = (element, platform, displayMode, isParent = false, componentDefinitions = {}) => {
  const metadata = { tree: [] };
  if (!element) {
    return null;
  }

  const {
    attributes: { subType },
    definition: { type, styleSelectors }
  } = element;

  let selector = get(styleSelectors, 'base', '');
  const selectorHasState = selector.includes(':');
  if (selectorHasState) {
    [selector] = selector.split(':');
  }

  const selectorSegments = stringToSelector(selector);

  // get element display mode styles (mobile -> tablet -> desktop)
  ['desktop', 'tablet', 'mobile'].forEach(mode => {
    const style = platform[mode][btoa(selector)];
    if (style && (mode !== displayMode || selectorHasState || isParent)) {
      metadata.tree.push({ name: selector, displayMode: mode, style: style.attributes, isParent });
    }

    // element subclasses style EX: .test.new (we have to get .test and .new for separated)
    if (selectorSegments.length > 1) {
      selectorSegments.forEach(segment => {
        const { type } = segment;
        let { value } = segment;
        switch (type) {
          case StyleSelectors.SELECTOR_CLASS:
            value = `.${value}`;
            break;
          case StyleSelectors.SELECTOR__ID:
            value = `#${value}`;
            break;
          default:
        }

        const style = platform[mode][btoa(value)];
        if (style) {
          metadata.tree.push({ name: value, displayMode: mode, style: style.attributes, isParent });
        }
      });
    }

    // global native type
    if (type && platform[mode][btoa(type)]) {
      metadata.tree.push({ name: type, displayMode: mode, style: platform[mode][btoa(type)].attributes, isParent });
    } else if (subType && platform[mode][btoa(subType)]) {
      metadata.tree.push({
        name: subType,
        displayMode: mode,
        style: platform[mode][btoa(subType)].attributes,
        isParent
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
    metadata.tree.push({ ...global, isParent });
  }

  return metadata;
};

export const calculateInheriting = (element, flat, platform, displayMode, styleSelector, componentDefinitions) => {
  const metadata = { tree: [], treeData: {}, style: {} };
  if (!element) {
    return metadata;
  }

  const { id } = element;
  while (element) {
    const styleData = getDataStyle(element, platform, displayMode, element.id !== id, componentDefinitions);
    metadata.tree = [...metadata.tree, ...styleData.tree];
    const parentId = get(element, 'definition.parentId');
    if (!parentId) {
      element = null;

      break;
    }

    element = flat[element.definition.parentId];
  }

  const finalMeta = {};
  metadata.tree.forEach(node => {
    const styleData = get(node, `style.${styleSelector}`, node.style);
    if (styleData) {
      let data = styleData;
      if (node.isParent) {
        data = pick(styleData, inheritableAttributesBase);
      }

      Object.keys(data).forEach(key => {
        if (!finalMeta[key]) {
          finalMeta[key] = [];
        }

        finalMeta[key].push({ key: node.name, value: data[key], displayMode: node.displayMode });
      });
    }
  });

  return { ...metadata, style: finalMeta };
};

export const calculateBindings = element => {
  const metadata = { tree: [], treeData: {}, style: {} };
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

export const cssToSelectors = (css = '', singleSelector = false) => {
  const match = [
    ...css
      .replaceAll('\n', '')
      .replaceAll(' ', '')
      .matchAll(/(?<selector>\.|#|)(?<selectorName>[a-z0-9_. -]+){(?<selectorData>[a-z0-9:; \-(),.%\n*/]+|)}/gim)
  ];
  const StyleConstantsList = Object.values(StyleConstants);
  const selectors = match.map(match => {
    const { selector, selectorName, selectorData } = match.groups;
    const selectorResult = { name: `${selector}${selectorName}`, attributes: {}, cache: match[0] };
    if (selectorData) {
      const propsMatch = [...selectorData.matchAll(/(?<propName>[a-z\- ]+):(?<propValue>[a-z0-9 ]+)/gim)];
      propsMatch
        .filter(prop => StyleConstantsList.includes(prop.groups.propName))
        .forEach(prop => {
          const { propName, propValue } = prop.groups;
          set(selectorResult, `attributes.${propName}`, `${propValue}`);
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
  [
    ...css.matchAll(/(?<selector>\.|#|)(?<selectorName>[a-z0-9_. -]+){(?<selectorData>[a-z0-9:; \-(),.%\n*/]+|)}/gim)
  ].forEach(match => {
    const { selector, selectorName, selectorData } = match.groups;
    const selectorNameCorrection = [...(selectorName.match(/[\n]/gim) ?? [])].length;
    const bFrom = allowPre ? match.index : 0;
    const bTo = bFrom + selector.length + selectorName.length + 1 - selectorNameCorrection;
    const aFrom = bTo + selectorData.length;
    const aTo = allowAfter ? aFrom + 1 : undefined;
    ranges.push({ from: bFrom, to: bTo }, { from: aFrom, to: aTo });
  });

  return ranges;
};

export const formatCssFromSelector = (css, singleSelector = true, tabIndentSpace = 2, filterProps = true) => {
  const match = [
    ...css
      .replaceAll('\n', '')
      .matchAll(
        /(?<selector>\.|#|)(?<selectorName>[a-z0-9_. -]+){(?<selectorData>[a-z0-9:; _(),.%\n*/#%'/=+"-@]+|)}/gim
      )
  ];
  const StyleConstantsList = Object.values(StyleConstants);
  const selectors = match.map(match => {
    const { selector, selectorName, selectorData } = match.groups;
    if (!selectorData) {
      return `${selector}${selectorName} {\n}`;
    }

    const propsMatch = [
      ...selectorData.matchAll(/(?<propName>[a-z\- ]+):([ ]+|)(?<propValue>([a-z-]+\(.*\)|".*"|[a-z0-9# %".-]+))/gim)
    ];
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

export const generateStyleSelector = (selector = '', values = {}) => {
  if (!selector || !values || typeof values !== 'object') {
    return undefined;
  }

  return {
    name: selector,
    attributes: values,
    cache: `${selector}{${processSelector(values)}}`
  };
};

export const makeSelector = (type, styleSelector = 'base', length = 4) => {
  let selector = `${type}-${makeId(length)}`;
  if (styleSelector !== 'base') {
    selector = `${type}-${styleSelector}-${makeId(length)}`;
  }

  return selector;
};
