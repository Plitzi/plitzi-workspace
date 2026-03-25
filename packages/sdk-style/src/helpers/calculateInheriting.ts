import { get, pick } from '@plitzi/plitzi-ui/helpers';

import { inheritableAttributesBase } from '@plitzi/sdk-shared';

import type { StyleHelperMetaData } from '../StyleHelper';
import type { ComponentDefinition, DisplayMode, Element, Schema, Style, StyleCategory } from '@plitzi/sdk-shared';

const getDefaultStyle = (
  componentType: string | undefined,
  subType: string | undefined,
  styleSelector = 'base',
  isParent = false,
  isAncestor = false,
  componentDefinitions: Record<string, ComponentDefinition> = {}
) => {
  let global = get(componentDefinitions, `${componentType}.defaultStyle`, undefined);
  if (!global) {
    return undefined;
  }

  if (global.subTypes && !subType) {
    subType = Object.keys(global.subTypes)[0];
  }

  if (subType && global.subTypes?.[subType]) {
    global = global.subTypes[subType];
  }

  return { ...global, style: get(global, `style.${styleSelector}`, {}), isParent, isAncestor };
};

const getSelectorsStyle = (selectors: string[], platform: Style['platform'], isParent = false, isAncestor = false) => {
  const tree: StyleHelperMetaData['tree'] = [];
  for (const displayMode of Object.keys(platform) as DisplayMode[]) {
    const group = get(platform, displayMode);
    for (const segment of Object.values(pick(group, selectors))) {
      const { name } = segment;
      const styleItem = get(platform, `${displayMode}.${name}`, undefined);
      if (styleItem) {
        tree.push({ name, displayMode, style: styleItem.attributes, isParent, isAncestor });
      }
    }
  }

  return tree;
};

const getDataStyle = (
  element: Element | undefined,
  componentType: string | undefined,
  platform: Style['platform'],
  styleSelector = 'base',
  isParent = false,
  isAncestor = false,
  componentDefinitions: Record<string, ComponentDefinition> = {},
  addSelectors: string[] = []
) => {
  const metadata: { tree: StyleHelperMetaData['tree'] } = { tree: [] };
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
  for (const displayMode of Object.keys(platform) as DisplayMode[]) {
    const platformGroup = get(platform, displayMode);
    const selectors = get(styleSelectors, styleSelector, '').split(' ');
    for (const selector of Object.values(pick(platformGroup, [...selectors, ...addSelectors]))) {
      const { name } = selector;
      const styleItem = get(platform, `${displayMode}.${name}`, undefined);
      if (styleItem) {
        metadata.tree.push({ name, displayMode, style: styleItem.attributes, isParent, isAncestor });
      }
    }

    // global native type
    if (!componentType) {
      continue;
    }

    const componentSelectors = Object.values(platformGroup).filter(styleItem => styleItem.type === 'element');
    const compStyleItem = componentSelectors.find(styleItem => styleItem.componentType === componentType);
    if (compStyleItem) {
      metadata.tree.push({
        name: type,
        displayMode,
        style: compStyleItem.attributes[styleSelector],
        isParent: false,
        isAncestor: false
      });
    }

    const styleItem = get(platform, `${displayMode}.${type}`, undefined);
    if (type && styleItem && !['class', 'element'].includes(styleItem.type)) {
      metadata.tree.push({ name: type, displayMode, style: styleItem.attributes, isParent, isAncestor });
    }

    const styleSubItem = subType ? get(platform, `${displayMode}.${subType}`, undefined) : undefined;
    if (subType && styleSubItem && !['class', 'element'].includes(styleSubItem.type)) {
      metadata.tree.push({ name: subType, displayMode, style: styleSubItem.attributes, isParent, isAncestor });
    }
  }

  // get global element type
  const globalStyle = getDefaultStyle(type, subType, styleSelector, isParent, isAncestor, componentDefinitions);
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
    tree.push(...styleData.tree.filter(node => !(skipSelectors.includes(node.name) && !node.isAncestor)));

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
  styleSelector: string = 'base',
  componentDefinitions: Record<string, ComponentDefinition> = {},
  skipSelectors: string[] = [],
  addSelectors: string[] = []
) => {
  const metadata: StyleHelperMetaData = { tree: [], style: {}, parentStyle: {} };
  if (!element && !componentType) {
    if (addSelectors.length) {
      metadata.tree.push(...getSelectorsStyle(addSelectors, platform));
    }
  } else if (element) {
    metadata.tree.push(
      ...getElementStyle(element, componentType, flat, platform, styleSelector, componentDefinitions, skipSelectors)
    );
  } else {
    const data = getDataStyle(
      undefined,
      componentType,
      platform,
      styleSelector,
      false,
      false,
      componentDefinitions,
      addSelectors
    );

    metadata.tree.push(...data.tree.filter(node => !(skipSelectors.includes(node.name) && !node.isAncestor)));
  }

  const finalStyle: StyleHelperMetaData['style'] = {};
  for (const node of metadata.tree) {
    let styleData = get(node, `style.${styleSelector}`, node.style) as Record<string, string> | undefined;
    if (!styleData) {
      continue;
    }

    // SubParent: only inheritable attributes
    if (node.isAncestor) {
      styleData = pick(styleData, inheritableAttributesBase);
    }

    for (const key of Object.keys(styleData) as StyleCategory[]) {
      const isAllowed = node.isAncestor ? inheritableAttributesBase.includes(key) : true;
      if (!isAllowed) {
        continue;
      }

      if (!(finalStyle[key] as (typeof finalStyle)[string] | undefined)) {
        finalStyle[key] = [];
      }

      finalStyle[key].push({ key: node.name, value: styleData[key], displayMode: node.displayMode });
    }
  }

  const parentStyle = metadata.tree
    .filter(node => node.isParent)
    .reduce((acc, node) => ({ ...acc, ...get(node, 'style', {}) }), {});

  return { ...metadata, style: finalStyle, parentStyle } as StyleHelperMetaData;
};

export default calculateInheriting;
