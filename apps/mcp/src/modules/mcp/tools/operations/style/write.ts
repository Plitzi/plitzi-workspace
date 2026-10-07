import { canonicalCondition } from '@plitzi/sdk-shared/style/styleConditions';
import { isStylePseudo } from '@plitzi/sdk-shared/style/stylePseudos';
import processSelector from '@plitzi/sdk-style/helpers/processSelector';

import { styleInputProblem } from './validate';
import { expandShorthand, expandShorthandPatch } from '../../../catalogs';
import { fail } from '../../../helpers';

import type {
  DefinitionSlotInput,
  DefinitionSlotPatch,
  PseudoPartInput,
  PseudoPartPatch,
  VariantPartInput,
  VariantPartPatch
} from './shared';
import type { CssPatch } from '../../../catalogs';
import type { OpResult } from '../../../helpers';
import type { AIDefinition, AIDefinitionSlot, AIPseudo, AIVariant, CssProps, DisplayModeCss } from '../../../types';
import type {
  DisplayMode,
  Style,
  StyleAttributes,
  StyleBlock,
  StyleItem,
  StylePseudos,
  StyleStateBlock,
  StyleStates,
  StyleVariant,
  TagType
} from '@plitzi/sdk-shared';

// Shared machinery for the style-schema handlers: stale-resource URI builders, the kind-clash guard, and the
// low-level StyleItem writer + patch merge that both definitions and global element selectors reuse.

export const MODES: DisplayMode[] = ['desktop', 'tablet', 'mobile'];

// URI builders are the single source of truth in helpers/uris; re-exported here so the style handlers keep
// importing them from `./write` unchanged.
export { defUri, defsUri, globalUri, globalsUri, idUri, idsUri, styleVarUri, styleVarsUri } from '../../../helpers';

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

/** A part with rules and states — a pseudo-element, a variant, a condition — at one breakpoint, or nothing there. */
const partAt = (part: PseudoPartInput, mode: DisplayMode): StyleStateBlock | undefined => {
  const block: StyleStateBlock = {};
  const css = part[mode];
  if (css && Object.keys(css).length > 0) {
    block.default = expandShorthand(css);
  }

  for (const [state, dm] of Object.entries(part.states ?? {})) {
    if (dm[mode]) {
      (block.states ??= {})[state as keyof StyleStates] = expandShorthand(dm[mode]);
    }
  }

  return block.default || block.states ? block : undefined;
};

const pseudosAt = (pseudos: VariantPartInput['pseudos'], mode: DisplayMode): StylePseudos | undefined => {
  const entries = Object.entries(pseudos ?? {}).flatMap(([pseudo, part]) => {
    const block = partAt(part, mode);

    return block && isStylePseudo(pseudo) ? [[pseudo, block] as const] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/** A variant or a condition at one breakpoint: its own part, and its pseudo-elements'. */
const variantAt = (part: VariantPartInput, mode: DisplayMode): StyleVariant | undefined => {
  const block = partAt(part, mode);
  const pseudos = pseudosAt(part.pseudos, mode);

  return block || pseudos ? { ...block, ...(pseudos ? { pseudos } : {}) } : undefined;
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

    for (const [name, variant] of Object.entries(slot.variants ?? {})) {
      const variantBlock = variantAt(variant, mode);
      if (variantBlock) {
        (block.variants ??= {})[name] = { default: {}, ...variantBlock };
      }
    }

    const pseudos = pseudosAt(slot.pseudos, mode);
    if (pseudos) {
      block.pseudos = pseudos;
    }

    for (const [key, condition] of Object.entries(slot.conditions ?? {})) {
      const conditionBlock = variantAt(condition, mode);
      // Validated before anything is written (`styleInputProblem`), so a key here is a condition: kept as it is spelt.
      const canonical = canonicalCondition(key) ?? key;
      if (conditionBlock) {
        (block.conditions ??= {})[canonical] = conditionBlock;
      }
    }

    for (const [ancestor, condition] of Object.entries(slot.ancestors ?? {})) {
      const conditionBlock = slotToBlocks(condition)[mode];
      if (conditionBlock) {
        (block.ancestors ??= {})[ancestor] = {
          ...(conditionBlock.default ? { default: conditionBlock.default } : {}),
          ...(conditionBlock.states ? { states: conditionBlock.states } : {}),
          ...(conditionBlock.variants ? { variants: conditionBlock.variants } : {})
        };
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
): OpResult | null => {
  const problem = styleInputProblem(base, slots);
  if (problem) {
    return problem;
  }

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

  return null;
};

// --- Partial merge (patch): overlay a patch onto the current definition, per breakpoint. A null CSS value removes
// that property; any declaration not mentioned is preserved. The fully merged structured definition is then
// re-written whole, so the persisted cache is always rebuilt from the complete, current CSS.

type DisplayModeCssPatch = Pick<DefinitionSlotPatch, 'desktop' | 'tablet' | 'mobile'>;

const mergeCss = (base: CssProps | undefined, patch: CssPatch | undefined): CssProps | undefined => {
  const merged: CssProps = { ...base };
  // The patch is atomized BEFORE it merges: what is already stored is longhand, so a shorthand would otherwise land
  // beside the longhands it is meant to replace (`{ padding: 8 }` leaving a previous `padding-left` untouched) and a
  // `{ padding: null }` removal would delete a key that was never stored.
  for (const [key, value] of Object.entries(expandShorthandPatch(patch ?? {}))) {
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

const mergeAncestors = (
  base: AIDefinitionSlot['ancestors'],
  patch: DefinitionSlotPatch['ancestors']
): DefinitionSlotInput['ancestors'] => {
  const names = new Set([...Object.keys(base ?? {}), ...Object.keys(patch ?? {})]);
  const result: NonNullable<DefinitionSlotInput['ancestors']> = {};
  for (const name of names) {
    const conditionPatch = patch?.[name];
    if (conditionPatch === null) {
      continue;
    }

    const inside = mergeDisplayMode(base?.[name], conditionPatch ?? undefined);
    const states = mergeNamedModes(base?.[name]?.states, conditionPatch?.states);
    const variants = mergeNamedModes(base?.[name]?.variants, conditionPatch?.variants);
    if (Object.keys(inside).length > 0 || states || variants) {
      result[name] = { ...inside, ...(states ? { states } : {}), ...(variants ? { variants } : {}) };
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

const mergePart = (base: AIPseudo | undefined, patch: PseudoPartPatch | undefined): PseudoPartInput => {
  const merged: PseudoPartInput = mergeDisplayMode(base, patch);
  const states = mergeNamedModes(base?.states, patch?.states);
  if (states) {
    merged.states = states;
  }

  return merged;
};

const mergePseudos = (
  base: Record<string, AIPseudo> | undefined,
  patch: Record<string, PseudoPartPatch | null> | undefined
): Record<string, PseudoPartInput> | undefined => {
  const names = new Set([...Object.keys(base ?? {}), ...Object.keys(patch ?? {})]);
  const result: Record<string, PseudoPartInput> = {};
  for (const name of names) {
    const partPatch = patch?.[name];
    if (partPatch === null) {
      continue;
    }

    const merged = mergePart(base?.[name], partPatch);
    if (Object.keys(merged).length > 0) {
      result[name] = merged;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

const mergeVariantPart = (base: AIVariant | undefined, patch: VariantPartPatch | undefined): VariantPartInput => {
  const merged: VariantPartInput = mergePart(base, patch);
  const pseudos = mergePseudos(base?.pseudos, patch?.pseudos);
  if (pseudos) {
    merged.pseudos = pseudos;
  }

  return merged;
};

/**
 * Variants or conditions, each merged whole — its rules, states and pseudo-elements — and one patched to `null`
 * removed. A condition is matched by the one spelling the document keeps, so a patch may write it as it likes.
 */
const mergeVariantParts = (
  base: Record<string, AIVariant> | undefined,
  patch: Record<string, VariantPartPatch | null> | undefined,
  keyOf: (key: string) => string = key => key
): Record<string, VariantPartInput> | undefined => {
  const patches = new Map(Object.entries(patch ?? {}).map(([key, value]) => [keyOf(key), value]));
  const names = new Set([...Object.keys(base ?? {}), ...patches.keys()]);
  const result: Record<string, VariantPartInput> = {};
  for (const name of names) {
    const partPatch = patches.get(name);
    if (partPatch === null) {
      continue;
    }

    const merged = mergeVariantPart(base?.[name], partPatch);
    if (Object.keys(merged).length > 0) {
      result[name] = merged;
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

  const variants = mergeVariantParts(base?.variants, patch.variants);
  if (variants) {
    merged.variants = variants;
  }

  const ancestors = mergeAncestors(base?.ancestors, patch.ancestors);
  if (ancestors) {
    merged.ancestors = ancestors;
  }

  const pseudos = mergePseudos(base?.pseudos, patch.pseudos);
  if (pseudos) {
    merged.pseudos = pseudos;
  }

  const conditions = mergeVariantParts(base?.conditions, patch.conditions, key => canonicalCondition(key) ?? key);
  if (conditions) {
    merged.conditions = conditions;
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
