import { empty } from '../opResult';

import type { DefinitionSlotInput } from './operations';
import type { Space } from '../../helpers';
import type { Env } from '../../types';
import type { Operation } from '../operations';
import type { OpResult } from '../opResult';
import type { DisplayMode, Style, StyleAttributes, StyleBlock } from '@plitzi/sdk-shared';

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
    if (slot[mode] && Object.keys(slot[mode]).length > 0) {
      block.default = slot[mode];
    }

    for (const [state, dm] of Object.entries(slot.states ?? {})) {
      if (dm[mode]) {
        (block.states ??= {})[state as keyof NonNullable<StyleBlock['states']>] = dm[mode];
      }
    }

    for (const [name, dm] of Object.entries(slot.variants ?? {})) {
      if (dm[mode]) {
        (block.variants ??= {})[name] = { default: dm[mode] };
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
      // cache is recompiled by the platform on persist; mcp writes the canonical structured source only.
      style.platform[mode][ref] = { name: ref, type: 'class', attributes, cache: '' };
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
