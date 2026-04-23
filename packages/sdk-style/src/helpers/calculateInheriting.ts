import { get, pick } from '@plitzi/plitzi-ui/helpers';

import { inheritableAttributesBase } from '@plitzi/sdk-shared/style';

import type {
  ComponentDefinition,
  DisplayMode,
  Element,
  Schema,
  Style,
  StyleBlock,
  StyleCategory,
  StyleItem,
  StyleState,
  StyleValue
} from '@plitzi/sdk-shared';

export type InheritData = {
  tree: {
    name: string;
    displayMode: DisplayMode;
    attributes: StyleItem['attributes'];
    componentType?: string;
    isDefault?: boolean;
    isParent: boolean;
    isAncestor: boolean;
  }[];
  style: Record<string, { key: string; value: StyleValue; displayMode: DisplayMode }[]>;
  parentStyle: Record<string, string>;
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
  const sources: StyleItem[] = [];
  const seen = new Set<string>();
  const {
    definition: { styleSelectors, type },
    attributes: { subType }
  } = node;

  const selectors = (styleSelectors[styleSelector] || '').split(' ').filter(Boolean);
  for (const name of [...selectors, ...addSelectors]) {
    if (seen.has(name)) {
      continue;
    }

    const styleItem = platformGroup[name];
    if (!(styleItem as StyleItem | undefined)?.name) {
      continue;
    }

    seen.add(name);
    sources.push(styleItem);
  }

  // Element styles
  if (componentType) {
    for (const item of Object.values(platformGroup)) {
      if (item.type === 'element' && item.componentType === componentType && item.name) {
        if (seen.has(item.name)) {
          continue;
        }

        seen.add(item.name);
        sources.push(item);
      }
    }
  }

  // Direct type
  const typeStyle = platformGroup[type] as StyleItem | undefined;
  if (typeStyle && typeStyle.name && !['class', 'element'].includes(typeStyle.type)) {
    if (!seen.has(typeStyle.name)) {
      seen.add(typeStyle.name);
      sources.push(typeStyle);
    }
  }

  // Subtype
  if (subType) {
    const subStyle = platformGroup[subType] as StyleItem | undefined;
    if (subStyle && subStyle.name && !['class', 'element'].includes(subStyle.type)) {
      if (!seen.has(subStyle.name)) {
        seen.add(subStyle.name);
        sources.push(subStyle);
      }
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
    name: 'defaultStyle',
    attributes: { [styleSelector]: get(global, `style.${styleSelector}`, {}) },
    componentType,
    isParent: false,
    isAncestor: false,
    isDefault: true
  };
};

/* -------------------- STYLE RESOLUTION -------------------- */

const resolveStyleBlock = (
  attributes: StyleItem['attributes'],
  styleSelector: string,
  styleState?: StyleState,
  styleVariant?: string
) => {
  const block = attributes[styleSelector];
  if (!(block as StyleBlock | undefined)) {
    return {};
  }

  const base = block.default ?? {};
  const variantBase = styleVariant ? (block.variants?.[styleVariant]?.default ?? {}) : {};
  const state = styleState ? (block.states?.[styleState] ?? {}) : {};
  const variantState = styleVariant && styleState ? (block.variants?.[styleVariant]?.states?.[styleState] ?? {}) : {};

  return {
    ...base,
    ...variantBase,
    ...state,
    ...variantState
  };
};

const resolveNodeStyle = (
  node: InheritData['tree'][number],
  styleSelector: string,
  styleState?: StyleState,
  styleVariant?: string
) => {
  return resolveStyleBlock(node.attributes, styleSelector, styleState, styleVariant);
};

/* --------------------------- MAIN CALCULATION ----------------------------- */

/**
 * ============================================================
 * 🧠 STYLE INHERITANCE FLOW (calculateInheriting)
 * ============================================================
 *
 * 🌳 HIERARCHY (top → bottom priority)
 *
 *   Ancestors
 *      ↓
 *   Parent
 *      ↓
 *   Current Element
 *      ↓
 *   DefaultStyle (componentDefinition fallback)
 *
 *
 * 🎯 SOURCE RESOLUTION (per node)
 *
 *   styleSelectors (e.g. "btn card")
 *          ↓
 *   StyleItem.attributes
 *          ↓
 *   resolveStyleBlock()
 *
 *
 * 🔥 STYLE LAYERING (inside a single StyleBlock)
 *
 *   base.default
 *        ↓
 *   variant.default
 *        ↓
 *   state
 *        ↓
 *   variant.state
 *
 *   Final:
 *
 *   {
 *     ...base,
 *     ...variant,
 *     ...state,
 *     ...variantState
 *   }
 *
 *
 * 🧩 FINAL MERGE (global result)
 *
 *   for each node in tree:
 *
 *     style = resolveNodeStyle(node)
 *
 *     if node.isAncestor:
 *       style = pick(inheritableAttributesBase)
 *
 *     for each key in style:
 *       finalStyle[key].push({
 *         value,
 *         source: node.name,
 *         displayMode
 *       })
 *
 *
 * ⚠️ PRIORITY RULES
 *
 *   Between nodes:
 *     ancestor < parent < current
 *
 *   Inside a node:
 *     base < variant < state < variant+state
 *
 *
 * 📱 DISPLAY MODES
 *
 *   Current order:
 *     desktop → tablet → mobile
 *
 *   (Can be extended to support:
 *     mobile-first or desktop-first)
 *
 *
 * 🚀 RESULT
 *
 *   finalStyle = {
 *     color: [
 *       { value: 'red', source: 'btn', displayMode: 'desktop' },
 *       { value: 'blue', source: 'btn', displayMode: 'tablet' }
 *     ]
 *   }
 *
 *   parentStyle = merged styles from direct parent only
 *
 * ============================================================
 */

const calculateInheriting = (
  element: Element | undefined,
  componentType: string | undefined,
  flat: Schema['flat'],
  platform: Style['platform'],
  componentDefinitions: Record<string, ComponentDefinition> = {},
  params: {
    componentSubType?: string;
    styleSelector?: string;
    styleState?: StyleState;
    styleVariant?: string;
    includeSelf?: boolean;
    skipSelectors?: string[];
    addSelectors?: string[];
  } = {}
): InheritData => {
  const {
    componentSubType,
    styleSelector = 'base',
    styleState,
    styleVariant,
    includeSelf = false,
    skipSelectors = [],
    addSelectors = []
  } = params;
  const metadata: InheritData = { tree: [], style: {}, parentStyle: {} };
  const hierarchy = element ? buildHierarchy(flat, element) : [];
  const seenDefaultTypes = new Set<string>();
  for (const displayMode of Object.keys(platform) as DisplayMode[]) {
    const group = platform[displayMode];
    if (!(group as Record<string, StyleItem> | undefined)) {
      continue;
    }

    // No element
    if (!element && !componentType) {
      for (const name of addSelectors) {
        const styleItem = group[name];
        if (!(styleItem as StyleItem | undefined)) {
          continue;
        }

        metadata.tree.push({
          name,
          displayMode,
          attributes: styleItem.attributes,
          isParent: false,
          isAncestor: false
        });
      }

      continue;
    }

    // Virtual node
    if (!element && componentType) {
      const virtualNode = {
        definition: { type: componentType, styleSelectors: {}, parentId: undefined },
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
          attributes: source.attributes,
          isParent: false,
          isAncestor: false
        });
      }

      const defaultStyle = getDefaultStyle(componentType, componentSubType, styleSelector, componentDefinitions);
      if (defaultStyle) {
        metadata.tree.push({ ...defaultStyle, displayMode });
      }

      continue;
    }

    // Hierarchy
    for (const node of hierarchy) {
      const isParent = element?.definition.parentId === node.id;
      const isAncestor = node.id !== element?.id;
      let sources = resolveSources(
        node,
        node.definition.type === componentType ? componentType : undefined,
        group,
        styleSelector,
        addSelectors
      );
      if (!includeSelf && !isAncestor && !styleState && !styleVariant && Object.keys(sources).length) {
        sources = sources.filter(source => source.type === 'element');
      }

      for (const source of sources) {
        if (skipSelectors.includes(source.name) && !isAncestor) {
          continue;
        }

        metadata.tree.push({
          name: source.name,
          displayMode,
          attributes: source.attributes,
          componentType: source.componentType,
          isParent,
          isAncestor,
          isDefault: false
        });
      }

      const defaultStyle = getDefaultStyle(
        node.definition.type,
        node.attributes.subType,
        styleSelector,
        componentDefinitions
      );

      if (defaultStyle && !seenDefaultTypes.has(node.definition.type)) {
        seenDefaultTypes.add(node.definition.type);
        metadata.tree.push({ ...defaultStyle, displayMode, isParent, isAncestor: false });
      }
    }
  }

  /* -------------------------- FINAL STYLE BUILD --------------------------- */

  const finalStyle: InheritData['style'] = {};
  for (const node of metadata.tree) {
    let styleData = resolveNodeStyle(node, styleSelector, styleState, styleVariant);
    if (!(styleData as typeof styleData | undefined)) {
      continue;
    }

    if (node.isAncestor) {
      styleData = pick(styleData, inheritableAttributesBase);
    }

    for (const key of Object.keys(styleData) as StyleCategory[]) {
      if (node.isAncestor && !inheritableAttributesBase.includes(key)) {
        continue;
      }

      if (!(finalStyle[key] as (typeof finalStyle)[string] | undefined)) {
        finalStyle[key] = [];
      }

      finalStyle[key].push({ key: node.name, value: styleData[key] as StyleValue, displayMode: node.displayMode });
    }
  }

  /* ---------------------------- PARENT STYLE ----------------------------- */

  const parentStyle = metadata.tree
    .filter(node => node.isParent)
    .reduce((acc, node) => ({ ...acc, ...resolveNodeStyle(node, styleSelector, styleState, styleVariant) }), {});

  return { ...metadata, style: finalStyle, parentStyle };
};

export default calculateInheriting;
