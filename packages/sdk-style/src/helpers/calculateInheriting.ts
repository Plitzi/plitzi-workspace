import get from 'lodash/get.js';
import pick from 'lodash/pick.js';

import { inheritableAttributesBase } from '@plitzi/sdk-shared';

import type { StyleHelperMetaData } from '../StyleHelper';
import type { ComponentDefinition, DisplayMode, Element, Schema, Style, StyleItem } from '@plitzi/sdk-shared';

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

const calculateInheriting = (
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

export default calculateInheriting;
