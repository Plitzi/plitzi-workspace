import { get, pick } from '@plitzi/plitzi-ui/helpers';

import { inheritableAttributesBase } from '@plitzi/sdk-shared';

import type {
  ComponentDefinition,
  DisplayMode,
  Element,
  Schema,
  Style,
  StyleCategory,
  StyleItem,
  StyleValue
} from '@plitzi/sdk-shared';

export type InheritData = {
  tree: {
    name: string;
    displayMode: DisplayMode;
    style: StyleItem['attributes'];
    isParent: boolean;
    isAncestor: boolean;
  }[];
  style: { [key: string]: { key: string; value: StyleValue; displayMode: DisplayMode }[] };
  parentStyle: { [key: string]: string };
};

/* --------------------------------- HELPERS -------------------------------- */

const buildHierarchy = (flat: Schema['flat'], element?: Element) => {
  const result: Element[] = [];

  let current = element;
  while (current) {
    result.push(current);
    const parentId = current.definition.parentId;
    current = parentId ? flat[parentId] : undefined;
  }

  return result;
};

const resolveSources = (
  node: Element,
  componentType: string | undefined,
  platformGroup: Style['platform'][DisplayMode],
  styleSelector: string,
  addSelectors: string[]
) => {
  const sources: { name: string; attributes: Record<string, unknown>; type: string; componentType?: string }[] = [];
  const {
    definition: { styleSelectors, type },
    attributes: { subType }
  } = node;

  // selectors (class)
  const selectors = (styleSelectors[styleSelector] || '').split(' ').filter(Boolean);

  for (const name of [...selectors, ...addSelectors]) {
    const styleItem = platformGroup[name] as StyleItem | undefined;
    if (!styleItem || !styleItem.name) {
      continue;
    }

    sources.push(styleItem);
  }

  // element styles
  if (componentType) {
    for (const item of Object.values(platformGroup)) {
      if (item.type === 'element' && item.componentType === componentType && item.name) {
        sources.push(item);
      }
    }
  }

  // direct type
  const typeStyle = platformGroup[type];
  const typedTypeStyle = typeStyle as StyleItem | undefined;
  if (typedTypeStyle && typedTypeStyle.name && !['class', 'element'].includes(typedTypeStyle.type)) {
    sources.push(typedTypeStyle);
  }

  // subtype
  if (subType) {
    const subStyle = platformGroup[subType];
    const typedSubStyle = subStyle as StyleItem | undefined;
    if (typedSubStyle && typedSubStyle.name && !['class', 'element'].includes(typedSubStyle.type)) {
      sources.push(typedSubStyle);
    }
  }

  return sources;
};

const getDefaultStyle = (
  componentType: string | undefined,
  subType: string | undefined,
  styleSelector: string,
  componentDefinitions: Record<string, ComponentDefinition>
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

  return {
    ...global,
    style: get(global, `style.${styleSelector}`, {}),
    isParent: false,
    isAncestor: false
  };
};

/* --------------------------- MAIN CALCULATION ----------------------------- */

const calculateInheriting = (
  element: Element | undefined,
  componentType: string | undefined,
  flat: Schema['flat'],
  platform: Style['platform'],
  styleSelector: string = 'base',
  componentDefinitions: Record<string, ComponentDefinition> = {},
  skipSelectors: string[] = [],
  addSelectors: string[] = []
): InheritData => {
  const metadata: InheritData = { tree: [], style: {}, parentStyle: {} };
  const hierarchy = element ? buildHierarchy(flat, element) : [];
  for (const displayMode of Object.keys(platform) as DisplayMode[]) {
    const group = platform[displayMode];

    // No element → only selectors
    if (!element && !componentType) {
      for (const name of addSelectors) {
        const styleItem = group[name];
        if (!(styleItem as StyleItem | undefined)) {
          continue;
        }

        metadata.tree.push({ name, displayMode, style: styleItem.attributes, isParent: false, isAncestor: false });
      }

      continue;
    }

    // Only componentType (no element) → treat as virtual node
    if (!element && componentType) {
      const virtualNode = {
        definition: {
          type: componentType,
          styleSelectors: {},
          parentId: undefined
        },
        attributes: {}
      } as unknown as Element;

      const sources = resolveSources(virtualNode, componentType, group, styleSelector, addSelectors);

      for (const source of sources) {
        if (skipSelectors.includes(source.name)) {
          continue;
        }

        metadata.tree.push({
          name: source.name,
          displayMode,
          style: source.attributes,
          isParent: false,
          isAncestor: false
        });
      }

      const defaultStyle = getDefaultStyle(componentType, undefined, styleSelector, componentDefinitions);
      if (defaultStyle) {
        metadata.tree.push({ ...defaultStyle, displayMode });
      }

      continue;
    }

    // Full hierarchy
    for (const node of hierarchy) {
      const isParent = element?.definition.parentId === node.id;
      const isAncestor = node.id !== element?.id;
      const sources = resolveSources(node, componentType, group, styleSelector, addSelectors);
      for (const source of sources) {
        if (skipSelectors.includes(source.name) && !isAncestor) {
          continue;
        }

        metadata.tree.push({ name: source.name, displayMode, style: source.attributes, isParent, isAncestor });
      }

      // Default style
      const defaultStyle = getDefaultStyle(
        node.definition.type,
        node.attributes.subType,
        styleSelector,
        componentDefinitions
      );

      if (defaultStyle) {
        metadata.tree.push({ ...defaultStyle, displayMode, isParent, isAncestor });
      }
    }
  }

  /* -------------------------- FINAL STYLE BUILD --------------------------- */

  const finalStyle: InheritData['style'] = {};
  for (const node of metadata.tree) {
    let styleData = get(node, `style.${styleSelector}`, node.style) as Record<string, string> | undefined;
    if (!styleData) {
      continue;
    }

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

      finalStyle[key].push({
        key: node.name,
        value: styleData[key],
        displayMode: node.displayMode
      });
    }
  }

  /* ---------------------------- PARENT STYLE ----------------------------- */

  const parentStyle = metadata.tree
    .filter(node => node.isParent)
    .reduce((acc, node) => ({ ...acc, ...get(node, 'style', {}) }), {});

  return { ...metadata, style: finalStyle, parentStyle };
};

export default calculateInheriting;
