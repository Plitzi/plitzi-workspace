import type { AIDefinition, AIDefinitionSlot, AIGlobalStyle, AIStyleVariable } from '../../types';
import type { DisplayMode, Style, StyleBlock, StyleItem } from '@plitzi/sdk-shared';

// Read projections of the STYLE schema: definition names, one definition's CSS, and design tokens.

const DISPLAY_MODES: DisplayMode[] = ['desktop', 'tablet', 'mobile'];

// A "definition" in the MCP model is only a reusable class (type 'class', selector `.name`). A type 'element'
// StyleItem is a GLOBAL style applied to every element of its componentType (selector `.plitzi__name`), and a
// type 'id' item targets a single id — neither is an addressable, editable definition here. They share the same
// platform map keyed by name, so every definition read/write must filter to classes, and writes must never
// overwrite a non-class item (that would silently strip its global reach). See TagType in StyleTypes.
export const isClassDefinition = (item: StyleItem): boolean => item.type === 'class';

export const definitionRefs = (style: Style): string[] => {
  const refs = new Set<string>();
  for (const mode of DISPLAY_MODES) {
    for (const [name, item] of Object.entries(style.platform[mode])) {
      if (isClassDefinition(item)) {
        refs.add(name);
      }
    }
  }

  return Array.from(refs).sort();
};

const fillSlot = (target: AIDefinitionSlot, mode: DisplayMode, block: StyleBlock): void => {
  if (block.default && Object.keys(block.default).length > 0) {
    target[mode] = block.default;
  }

  if (block.states) {
    for (const [state, obj] of Object.entries(block.states)) {
      if (Object.keys(obj).length > 0) {
        (target.states ??= {})[state] ??= {};
        target.states[state][mode] = obj;
      }
    }
  }

  if (block.variants) {
    for (const [name, variant] of Object.entries(block.variants)) {
      if (variant.default && Object.keys(variant.default).length > 0) {
        (target.variants ??= {})[name] ??= {};
        target.variants[name][mode] = variant.default;
      }
    }
  }
};

// Project one StyleItem (by name) into an AIDefinition, across breakpoints, taking only the items an `accept`
// predicate allows — so the same shape backs both class definitions and global element selectors.
const projectItem = (style: Style, ref: string, accept: (item: StyleItem) => boolean): AIDefinition | undefined => {
  const def: AIDefinition = { ref };
  let found = false;
  for (const mode of DISPLAY_MODES) {
    const item = style.platform[mode][ref] as StyleItem | undefined;
    if (!item || !accept(item)) {
      continue;
    }

    found = true;
    for (const [slot, block] of Object.entries(item.attributes)) {
      if (slot === 'base') {
        fillSlot(def, mode, block);
      } else {
        fillSlot(((def.slots ??= {})[slot] ??= {}), mode, block);
      }
    }
  }

  return found ? def : undefined;
};

export const definitionToAI = (style: Style, ref: string): AIDefinition | undefined =>
  projectItem(style, ref, isClassDefinition);

// Global element selectors that target `componentType` — the CSS equivalent of `button { … }`, affecting EVERY
// element of that type. Collected so an element read shows the full effective CSS, not just its own classes.
export const globalStylesForType = (style: Style, componentType: string): AIGlobalStyle[] => {
  const isGlobal = (item: StyleItem): boolean => item.type === 'element' && item.componentType === componentType;
  const refs = new Set<string>();
  for (const mode of DISPLAY_MODES) {
    for (const [name, item] of Object.entries(style.platform[mode])) {
      if (isGlobal(item)) {
        refs.add(name);
      }
    }
  }

  const globals: AIGlobalStyle[] = [];
  for (const ref of Array.from(refs).sort()) {
    const def = projectItem(style, ref, isGlobal);
    if (def) {
      globals.push({ ...def, appliesToType: componentType });
    }
  }

  return globals;
};

// The single global the write tools address: the item keyed by componentType (name === componentType), which is
// how the builder stores a type's global selector. Used to read one back and to merge patches into it.
export const globalStyleToAI = (style: Style, componentType: string): AIGlobalStyle | undefined => {
  const def = projectItem(
    style,
    componentType,
    item => item.type === 'element' && item.componentType === componentType
  );

  return def ? { ...def, appliesToType: componentType } : undefined;
};

export const globalStyleTypes = (style: Style): string[] => {
  const types = new Set<string>();
  for (const mode of DISPLAY_MODES) {
    for (const item of Object.values(style.platform[mode])) {
      if (item.type === 'element' && item.componentType) {
        types.add(item.componentType);
      }
    }
  }

  return Array.from(types).sort();
};

export const styleVariablesToAI = (style: Style): Record<string, AIStyleVariable[]> => {
  const data: Record<string, AIStyleVariable[]> = {};

  for (const [category, group] of Object.entries(style.variables)) {
    data[category] = Object.entries(group).map(([name, value]) => ({
      name,
      reference: `var(--${name})`,
      value
    }));
  }

  return data;
};
