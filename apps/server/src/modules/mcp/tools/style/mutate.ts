import processSelector from '@plitzi/sdk-style/helpers/processSelector';

import { expandShorthand } from '../../resources';
import { empty } from '../opResult';

import type { DefinitionSlotInput } from './operations';
import type { Space } from '../../helpers';
import type { Env } from '../../types';
import type { Operation } from '../operations';
import type { OpResult } from '../opResult';
import type { DisplayMode, Style, StyleAttributes, StyleBlock, StyleItem } from '@plitzi/sdk-shared';

// Handlers that mutate the STYLE schema (space.style): definitions and design tokens.

const MODES: DisplayMode[] = ['desktop', 'tablet', 'mobile'];

const defUri = (env: Env, ref: string): string => `plitzi://definitions/${env}/${ref}`;
const defsUri = (env: Env): string => `plitzi://definitions/${env}`;
const styleVarUri = (env: Env, category: string): string => `plitzi://style-variables/${env}/${category}`;
const styleVarsUri = (env: Env): string => `plitzi://style-variables/${env}`;

const slotToBlocks = (slot: DefinitionSlotInput): Partial<Record<DisplayMode, StyleBlock>> => {
  const perMode: Partial<Record<DisplayMode, StyleBlock>> = {};

  for (const mode of MODES) {
    const block: StyleBlock = {};
    const baseCss = slot[mode];
    if (baseCss && Object.keys(baseCss).length > 0) {
      block.default = expandShorthand(baseCss);
    }

    for (const [state, dm] of Object.entries(slot.states ?? {})) {
      if (dm[mode]) {
        (block.states ??= {})[state as keyof NonNullable<StyleBlock['states']>] = expandShorthand(dm[mode]);
      }
    }

    for (const [name, dm] of Object.entries(slot.variants ?? {})) {
      if (dm[mode]) {
        (block.variants ??= {})[name] = { default: expandShorthand(dm[mode]) };
      }
    }

    if (Object.keys(block).length > 0) {
      perMode[mode] = block;
    }
  }

  return perMode;
};

const writeDefinition = (
  style: Style,
  ref: string,
  base: DefinitionSlotInput,
  slots: Record<string, DefinitionSlotInput> | undefined
): void => {
  for (const mode of MODES) {
    const attributes: StyleAttributes = {};
    const baseBlocks = slotToBlocks(base);
    if (baseBlocks[mode]) {
      attributes.base = baseBlocks[mode];
    }

    for (const [slotName, slotDef] of Object.entries(slots ?? {})) {
      const blocks = slotToBlocks(slotDef);
      if (blocks[mode]) {
        attributes[slotName] = blocks[mode];
      }
    }

    if (Object.keys(attributes).length === 0) {
      Reflect.deleteProperty(style.platform[mode], ref);
    } else {
      // generateCache (on persist) only concatenates each StyleItem's own `cache`, so it must be compiled here
      // from the structured attributes; otherwise both the item cache and the global style.cache drop this def.
      const styleItem: StyleItem = { name: ref, type: 'class', attributes, cache: '' };
      styleItem.cache = processSelector(styleItem);
      style.platform[mode][ref] = styleItem;
    }
  }
};

export const upsertDefinition = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'upsertDefinition' }>
): OpResult => {
  const { type, ref, slots, ...base } = op;
  void type;
  writeDefinition(space.style, ref, base, slots);

  return { ...empty(), updated: 1, staleResources: [defUri(env, ref), defsUri(env)] };
};

export const deleteDefinition = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'deleteDefinition' }>
): OpResult => {
  for (const mode of MODES) {
    Reflect.deleteProperty(space.style.platform[mode], op.ref);
  }

  return { ...empty(), deleted: 1, staleResources: [defUri(env, op.ref), defsUri(env)] };
};

export const upsertStyleVariable = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'upsertStyleVariable' }>
): OpResult => {
  const group = (space.style.variables[op.category] ??= {});
  group[op.name] = op.value;

  return { ...empty(), updated: 1, staleResources: [styleVarUri(env, op.category), styleVarsUri(env)] };
};

export const deleteStyleVariable = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'deleteStyleVariable' }>
): OpResult => {
  const group = space.style.variables[op.category];
  if (group) {
    Reflect.deleteProperty(group, op.name);
  }

  return { ...empty(), deleted: 1, staleResources: [styleVarUri(env, op.category), styleVarsUri(env)] };
};
