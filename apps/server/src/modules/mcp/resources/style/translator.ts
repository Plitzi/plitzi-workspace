import type { AIDefinition, AIDefinitionSlot, AIStyleVariable } from '../../types';
import type { DisplayMode, Style, StyleBlock } from '@plitzi/sdk-shared';

// Read projections of the STYLE schema: definition names, one definition's CSS, and design tokens.

const DISPLAY_MODES: DisplayMode[] = ['desktop', 'tablet', 'mobile'];

export const definitionRefs = (style: Style): string[] => {
  const refs = new Set<string>();
  for (const mode of DISPLAY_MODES) {
    for (const name of Object.keys(style.platform[mode])) {
      refs.add(name);
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

export const definitionToAI = (style: Style, ref: string): AIDefinition | undefined => {
  const def: AIDefinition = { ref };
  let found = false;
  for (const mode of DISPLAY_MODES) {
    const modeItems = style.platform[mode];
    if (!Object.hasOwn(modeItems, ref)) {
      continue;
    }

    found = true;
    for (const [slot, block] of Object.entries(modeItems[ref].attributes)) {
      if (slot === 'base') {
        fillSlot(def, mode, block);
      } else {
        fillSlot(((def.slots ??= {})[slot] ??= {}), mode, block);
      }
    }
  }

  return found ? def : undefined;
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
