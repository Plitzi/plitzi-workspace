import processSelector from '@plitzi/sdk-style/helpers/processSelector';

import { expandShorthand } from './cssCatalog';
import { fail } from '../../../helpers';

import type { DefinitionSlotInput, DefinitionSlotPatch } from './shared';
import type { OpResult } from '../../../helpers';
import type { AIDefinition, AIDefinitionSlot, CssProps, DisplayModeCss, Env } from '../../../types';
import type { DisplayMode, Style, StyleAttributes, StyleBlock, StyleItem, TagType } from '@plitzi/sdk-shared';

// Shared machinery for the style-schema handlers: stale-resource URI builders, the kind-clash guard, and the
// low-level StyleItem writer + patch merge that both definitions and global element selectors reuse.

export const MODES: DisplayMode[] = ['desktop', 'tablet', 'mobile'];

export const defUri = (env: Env, ref: string): string => `plitzi://definitions/${env}/${ref}`;
export const defsUri = (env: Env): string => `plitzi://definitions/${env}`;
export const globalUri = (env: Env, componentType: string): string => `plitzi://global-styles/${env}/${componentType}`;
export const globalsUri = (env: Env): string => `plitzi://global-styles/${env}`;
export const idUri = (env: Env, targetId: string): string => `plitzi://id-styles/${env}/${targetId}`;
export const idsUri = (env: Env): string => `plitzi://id-styles/${env}`;
export const styleVarUri = (env: Env, category: string): string => `plitzi://style-variables/${env}/${category}`;
export const styleVarsUri = (env: Env): string => `plitzi://style-variables/${env}`;

// The three kinds a StyleItem can be, each addressed by its own op family and identifier — a shared vocabulary for
// the clash guard's teachable errors.
const KIND_LABEL: Record<TagType, string> = {
  class: 'a reusable class definition',
  element: 'a global style for an element type',
  id: 'an id rule targeting a single element'
};

const KIND_TOOL: Record<TagType, string> = {
  class: 'upsertDefinition/patchDefinition',
  element: 'upsertGlobalStyle/patchGlobalStyle',
  id: 'upsertIdStyle/patchIdStyle'
};

const KIND_FIELD: Record<TagType, string> = { class: 'ref', element: 'componentType', id: 'targetId' };

// Class definitions, global (type 'element') selectors and id rules all share the same name→StyleItem map, so a
// write of one kind must never land on a name already held by another: that would silently convert it (a class
// turned global would then restyle EVERY element of a type; a global turned class would lose that reach). This is
// the guard against false positives — refuse when the name is occupied by a different kind, pointing to the right
// tool.
export const guardKind = (style: Style, ref: string, want: TagType): OpResult | null => {
  const clash = MODES.map(mode => style.platform[mode][ref] as StyleItem | undefined).find(
    (item): item is StyleItem => item !== undefined && item.type !== want
  );
  if (!clash) {
    return null;
  }

  return fail(
    KIND_FIELD[want],
    `"${ref}" is already ${KIND_LABEL[clash.type]}; it cannot be edited as ${KIND_LABEL[want]}`,
    `Edit it with ${KIND_TOOL[clash.type]}, or choose a different ${KIND_FIELD[want]}.`
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
export const writeStyleItem = (
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

// --- Partial merge (patch): overlay a patch onto the current definition, per breakpoint. A null CSS value removes
// that property; any declaration not mentioned is preserved. The fully merged structured definition is then
// re-written whole, so the persisted cache is always rebuilt from the complete, current CSS.

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
export const mergePatch = (
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
