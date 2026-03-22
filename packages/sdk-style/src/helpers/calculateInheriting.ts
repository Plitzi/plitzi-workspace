import { get, pick } from '@plitzi/plitzi-ui/helpers';

import { inheritableAttributesBase } from '@plitzi/sdk-shared';

import type { StyleHelperMetaData } from '../StyleHelper';
import type { ComponentDefinition, DisplayMode, Element, Schema, Style, StyleCategory } from '@plitzi/sdk-shared';

// no esta detectando los class-component

const getDefaultStyle = (
  componentType: string | undefined,
  subType: string | undefined,
  styleSelector = 'base',
  isParent = false,
  isSubParent = false,
  componentDefinitions: Record<string, ComponentDefinition> = {}
) => {
  let global = get(componentDefinitions, `${componentType}.defaultStyle`, undefined);
  if (!global) {
    return undefined;
  }

  if (subType) {
    const subGlobal = global.subTypes?.[subType];
    if (subGlobal) {
      global = subGlobal;
    }
  }

  return { ...global, style: get(global, `style.${styleSelector}`, {}), isParent, isSubParent };
};

const getDataStyle = (
  element: Element | undefined,
  componentType: string | undefined,
  platform: Style['platform'],
  styleSelector = 'base',
  isParent = false,
  isSubParent = false,
  componentDefinitions: Record<string, ComponentDefinition> = {}
) => {
  const metadata: { tree: StyleHelperMetaData['tree'] } = { tree: [] };
  if (!element && !componentType) {
    return undefined;
  }

  if (!element) {
    const globalStyle = getDefaultStyle(componentType, undefined, styleSelector, false, false, componentDefinitions);
    if (globalStyle) {
      metadata.tree.push(globalStyle);
    }

    return metadata;
  }

  const {
    attributes: { subType },
    definition: { type, styleSelectors }
  } = element;

  // get element display mode styles (mobile -> tablet -> desktop)
  for (const displayMode of ['desktop', 'tablet', 'mobile'] as DisplayMode[]) {
    const platformGroup = get(platform, displayMode, undefined);
    if (!platformGroup) {
      continue;
    }

    const selectors = get(styleSelectors, styleSelector, '').split(' ');
    const selectorSegments = Object.values(pick(platformGroup, selectors));
    for (const segment of selectorSegments) {
      const { name } = segment;
      const styleItem = get(platform, `${displayMode}.${name}`, undefined);
      if (styleItem) {
        metadata.tree.push({ name, displayMode, style: styleItem.attributes, isParent, isSubParent });
      }
    }

    // global native type
    if (!componentType) {
      continue;
    }

    const componentSelectors = Object.values(platformGroup).filter(styleItem => styleItem.type === 'class-component');
    const compStyleItem = componentSelectors.find(styleItem => styleItem.componentType === componentType);
    if (compStyleItem) {
      metadata.tree.push({
        name: type,
        displayMode,
        style: compStyleItem.attributes[styleSelector],
        isParent: false,
        isSubParent: false
      });
    }

    const styleItem = get(platform, `${displayMode}.${type}`, undefined);
    if (type && styleItem && !['class', 'class-component'].includes(styleItem.type)) {
      metadata.tree.push({ name: type, displayMode, style: styleItem.attributes, isParent, isSubParent });
    }

    const styleSubItem = subType ? get(platform, `${displayMode}.${subType}`, undefined) : undefined;
    if (subType && styleSubItem && !['class', 'class-component'].includes(styleSubItem.type)) {
      metadata.tree.push({ name: subType, displayMode, style: styleSubItem.attributes, isParent, isSubParent });
    }
  }

  // get global element type
  const globalStyle = getDefaultStyle(type, subType, styleSelector, isParent, isSubParent, componentDefinitions);
  if (globalStyle) {
    metadata.tree.push(globalStyle);
  }

  return metadata;
};

const getElementStyle = (
  element: Element,
  componentType: string | undefined,
  flat: Schema['flat'],
  platform: Style['platform'],
  styleSelector = 'base',
  componentDefinitions: Record<string, ComponentDefinition> = {},
  skipSelectors: string[] = []
) => {
  const tree: StyleHelperMetaData['tree'] = [];
  const { id } = element;
  const parentId = get(element, 'definition.parentId');
  let elementLoop = element as Element | undefined;
  while (elementLoop) {
    const styleData = getDataStyle(
      elementLoop,
      componentType,
      platform,
      styleSelector,
      elementLoop.id === parentId,
      id !== elementLoop.id,
      componentDefinitions
    );
    if (styleData) {
      tree.push(...styleData.tree.filter(node => !(skipSelectors.includes(node.name) && !node.isSubParent)));
    }

    if (elementLoop.id === id && styleSelector !== 'base') {
      elementLoop = undefined;
    } else {
      elementLoop = get(flat, get(elementLoop, 'definition.parentId', ''), undefined);
    }
  }

  return tree;
};

const calculateInheriting = (
  element: Element | undefined,
  componentType: string | undefined,
  flat: Schema['flat'],
  platform: Style['platform'],
  styleSelector?: string,
  componentDefinitions: Record<string, ComponentDefinition> = {},
  skipSelectors: string[] = []
) => {
  const metadata: StyleHelperMetaData = { tree: [], style: {}, parentStyle: {} };
  if (!element && !componentType) {
    return metadata;
  }

  if (element) {
    metadata.tree.push(
      ...getElementStyle(element, componentType, flat, platform, styleSelector, componentDefinitions, skipSelectors)
    );
  } else {
    const styleData = getDataStyle(
      undefined,
      componentType,
      platform,
      styleSelector,
      false,
      false,
      componentDefinitions
    );
    if (styleData) {
      metadata.tree.push(...styleData.tree.filter(node => !(skipSelectors.includes(node.name) && !node.isSubParent)));
    }
  }

  // base styleSelector to continue the rest of the logic
  styleSelector = 'base';

  const finalMeta: StyleHelperMetaData['style'] = {};
  metadata.tree.forEach(node => {
    let styleData = get(node, `style.${styleSelector}`, node.style) as { [key: string]: string } | undefined;
    if (!styleData) {
      return;
    }

    if (node.isSubParent) {
      styleData = pick(styleData, inheritableAttributesBase);
    }

    (Object.keys(styleData) as StyleCategory[])
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
