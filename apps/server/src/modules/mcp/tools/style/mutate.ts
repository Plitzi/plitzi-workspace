import processSelector from '@plitzi/sdk-style/helpers/processSelector';

import { definitionToAI, expandShorthand, globalStyleToAI } from '../../resources';
import { empty, fail } from '../opResult';

import type { DefinitionSlotInput, DefinitionSlotPatch } from './operations';
import type { Space } from '../../helpers';
import type { AIDefinition, AIDefinitionSlot, CssProps, DisplayModeCss, Env } from '../../types';
import type { Operation } from '../operations';
import type { OpResult } from '../opResult';
import type { DisplayMode, Style, StyleAttributes, StyleBlock, StyleItem, TagType } from '@plitzi/sdk-shared';

// Handlers that mutate the STYLE schema (space.style): definitions, global element selectors, and design tokens.

const MODES: DisplayMode[] = ['desktop', 'tablet', 'mobile'];

const defUri = (env: Env, ref: string): string => `plitzi://definitions/${env}/${ref}`;
const defsUri = (env: Env): string => `plitzi://definitions/${env}`;
const globalUri = (env: Env, componentType: string): string => `plitzi://global-styles/${env}/${componentType}`;
const globalsUri = (env: Env): string => `plitzi://global-styles/${env}`;
const styleVarUri = (env: Env, category: string): string => `plitzi://style-variables/${env}/${category}`;
const styleVarsUri = (env: Env): string => `plitzi://style-variables/${env}`;

const describeKind = (item: StyleItem): string =>
  item.type === 'element'
    ? `a global style for every "${item.componentType}" element`
    : item.type === 'class'
      ? 'a reusable class definition'
      : 'an id rule';

// Class definitions and global (type 'element') selectors share the same name→StyleItem map, so a write of one
// kind must never land on a name already held by the other: that would silently convert it (a class turned global
// would then restyle EVERY element of a type; a global turned class would lose that reach). This is the guard
// against false positives — refuse when the name is occupied by a different kind, pointing to the right tool.
const guardKind = (style: Style, ref: string, want: TagType): OpResult | null => {
  const clash = MODES.map(mode => style.platform[mode][ref] as StyleItem | undefined).find(
    (item): item is StyleItem => item !== undefined && item.type !== want
  );
  if (!clash) {
    return null;
  }

  const wantIsClass = want === 'class';

  return fail(
    wantIsClass ? 'ref' : 'componentType',
    `"${ref}" is already ${describeKind(clash)}; it cannot be edited as ${wantIsClass ? 'a class definition' : 'a global element style'}`,
    wantIsClass
      ? 'To restyle every element of a type on purpose, use upsertGlobalStyle/patchGlobalStyle with its componentType. Otherwise pick a different class name.'
      : 'That name is a class definition — edit it with upsertDefinition/patchDefinition, or choose a different componentType.'
  );
};

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

// Write a StyleItem (class definition or global element selector) across breakpoints from its structured input.
// itemType/componentType decide the kind: 'class' with no componentType (selector `.name`), or 'element' with a
// componentType (selector `.plitzi__name`, name === componentType) that styles every element of that type.
const writeStyleItem = (
  style: Style,
  ref: string,
  base: DefinitionSlotInput,
  slots: Record<string, DefinitionSlotInput> | undefined,
  itemType: TagType,
  componentType: string | undefined
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
      // from the structured attributes; otherwise both the item cache and the global style.cache drop this item.
      const styleItem: StyleItem = { name: ref, type: itemType, attributes, cache: '' };
      if (componentType !== undefined) {
        styleItem.componentType = componentType;
      }

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
  const guard = guardKind(space.style, ref, 'class');
  if (guard) {
    return guard;
  }

  writeStyleItem(space.style, ref, base, slots, 'class', undefined);

  return { ...empty(), updated: 1, staleResources: [defUri(env, ref), defsUri(env)] };
};

// --- Partial merge (patchDefinition): overlay a patch onto the current definition, per breakpoint. A null CSS
// value removes that property; any declaration not mentioned is preserved. The fully merged structured definition
// is then re-written whole, so the persisted cache is always rebuilt from the complete, current CSS.

type DisplayModeCssPatch = Pick<DefinitionSlotPatch, 'desktop' | 'tablet' | 'mobile'>;

const mergeCss = (
  base: CssProps | undefined,
  patch: Record<string, string | number | null> | undefined
): CssProps | undefined => {
  const merged: CssProps = { ...base };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === null) {
      Reflect.deleteProperty(merged, key);
    } else {
      merged[key] = value;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};

const mergeDisplayMode = (base: DisplayModeCss | undefined, patch: DisplayModeCssPatch | undefined): DisplayModeCss => {
  const result: DisplayModeCss = {};
  for (const mode of MODES) {
    const css = mergeCss(base?.[mode], patch?.[mode]);
    if (css) {
      result[mode] = css;
    }
  }

  return result;
};

const mergeNamedModes = (
  base: Record<string, DisplayModeCss> | undefined,
  patch: Record<string, DisplayModeCssPatch> | undefined
): Record<string, DisplayModeCss> | undefined => {
  const names = new Set([...Object.keys(base ?? {}), ...Object.keys(patch ?? {})]);
  const result: Record<string, DisplayModeCss> = {};
  for (const name of names) {
    const dm = mergeDisplayMode(base?.[name], patch?.[name]);
    if (Object.keys(dm).length > 0) {
      result[name] = dm;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

const mergeSlot = (base: AIDefinitionSlot | undefined, patch: DefinitionSlotPatch): DefinitionSlotInput => {
  const merged: DefinitionSlotInput = mergeDisplayMode(base, patch);
  const states = mergeNamedModes(base?.states, patch.states);
  if (states) {
    merged.states = states;
  }

  const variants = mergeNamedModes(base?.variants, patch.variants);
  if (variants) {
    merged.variants = variants;
  }

  return merged;
};

// Merge a patch (base + slots) onto an existing item's projection, reusing the per-breakpoint/state/variant merge.
const mergePatch = (
  existing: AIDefinition,
  basePatch: DefinitionSlotPatch,
  slotsPatch: Record<string, DefinitionSlotPatch> | undefined
): { base: DefinitionSlotInput; slots: Record<string, DefinitionSlotInput> | undefined } => {
  const base = mergeSlot(existing, basePatch);
  const slotNames = new Set([...Object.keys(existing.slots ?? {}), ...Object.keys(slotsPatch ?? {})]);
  const slots: Record<string, DefinitionSlotInput> = {};
  for (const name of slotNames) {
    slots[name] = mergeSlot(existing.slots?.[name], slotsPatch?.[name] ?? {});
  }

  return { base, slots: Object.keys(slots).length > 0 ? slots : undefined };
};

export const patchDefinition = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'patchDefinition' }>
): OpResult => {
  const guard = guardKind(space.style, op.ref, 'class');
  if (guard) {
    return guard;
  }

  const existing = definitionToAI(space.style, op.ref);
  if (!existing) {
    return fail(
      'ref',
      `Definition "${op.ref}" not found`,
      'patchDefinition only updates an existing definition; use upsertDefinition to create one'
    );
  }

  const { type, ref, slots: slotsPatch, ...basePatch } = op;
  void type;
  const { base, slots } = mergePatch(existing, basePatch, slotsPatch);
  writeStyleItem(space.style, ref, base, slots, 'class', undefined);

  return { ...empty(), updated: 1, staleResources: [defUri(env, ref), defsUri(env)] };
};

export const deleteDefinition = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'deleteDefinition' }>
): OpResult => {
  const guard = guardKind(space.style, op.ref, 'class');
  if (guard) {
    return guard;
  }

  for (const mode of MODES) {
    Reflect.deleteProperty(space.style.platform[mode], op.ref);
  }

  return { ...empty(), deleted: 1, staleResources: [defUri(env, op.ref), defsUri(env)] };
};

// --- Global element selectors (type 'element'): styles applied to EVERY element of a componentType. Keyed by the
// componentType (name === componentType). Same write/merge machinery as definitions, but a different item kind.

export const upsertGlobalStyle = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'upsertGlobalStyle' }>
): OpResult => {
  const { type, componentType, slots, ...base } = op;
  void type;
  const guard = guardKind(space.style, componentType, 'element');
  if (guard) {
    return guard;
  }

  writeStyleItem(space.style, componentType, base, slots, 'element', componentType);

  return { ...empty(), updated: 1, staleResources: [globalUri(env, componentType), globalsUri(env)] };
};

export const patchGlobalStyle = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'patchGlobalStyle' }>
): OpResult => {
  const guard = guardKind(space.style, op.componentType, 'element');
  if (guard) {
    return guard;
  }

  const existing = globalStyleToAI(space.style, op.componentType);
  if (!existing) {
    return fail(
      'componentType',
      `No global style for "${op.componentType}"`,
      'patchGlobalStyle only updates an existing global; use upsertGlobalStyle to create one'
    );
  }

  const { type, componentType, slots: slotsPatch, ...basePatch } = op;
  void type;
  const { base, slots } = mergePatch(existing, basePatch, slotsPatch);
  writeStyleItem(space.style, componentType, base, slots, 'element', componentType);

  return { ...empty(), updated: 1, staleResources: [globalUri(env, componentType), globalsUri(env)] };
};

export const deleteGlobalStyle = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'deleteGlobalStyle' }>
): OpResult => {
  const guard = guardKind(space.style, op.componentType, 'element');
  if (guard) {
    return guard;
  }

  for (const mode of MODES) {
    Reflect.deleteProperty(space.style.platform[mode], op.componentType);
  }

  return { ...empty(), deleted: 1, staleResources: [globalUri(env, op.componentType), globalsUri(env)] };
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
