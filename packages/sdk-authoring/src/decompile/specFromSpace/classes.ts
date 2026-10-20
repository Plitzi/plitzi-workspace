import { css, modifierClassName } from '../../style';
import { foldCustomCss } from '../customCss';
import { readSelector, unwritableCss } from '../styles';
import { childrenOf, componentRoots } from './tree';
import { isEmpty, correct } from './values';

import type { SpecReader } from './reader';
import type { SpaceSpec } from '../../schema';
import type { CssSpec, StatesSpec, StyleSpec } from '../../style';
import type { FoldAncestor, FoldTarget } from '../customCss';
import type { ReadSelector, SelectorBlocks, UnwritableRules } from '../styles';
import type { Roots } from './types';
import type {
  Element,
  Style,
  StyleAncestor,
  StyleBlock,
  StyleCondition,
  StyleObject,
  StyleState,
  StyleStateBlock
} from '@plitzi/sdk-shared';

/** The class names a selector joins with a space — one for most, several where the builder stacked them. */
export const classesOf = (selector: string): string[] => selector.split(/\s+/).filter(Boolean);

/**
 * A space document, read back into the declaration that would author it.
 *
 * `authorSpace` turns a spec into documents and derives every id, selector name and back-reference on the way. This
 * is the other direction: it reads the documents and keeps only what a person decided, so the result can be written
 * out as code and authored again. What comes back is EQUIVALENT rather than identical — a selector used by one
 * element becomes that element's own `css` and is renamed on the way back in, a binding's id is re-derived — and
 * every difference of that kind is one nothing else in the document can observe.
 *
 * Documents found in the wild are not all well formed, and some were written by a builder that has since moved on.
 * Rather than refusing them, what can be repaired is repaired and every repair is reported in `corrections`, so a
 * person can read what changed. Nothing is changed silently, and nothing that renders is dropped.
 */
/** The selector a folded target was written as, for the correction that reports it. */
const foldedSelector = ({ className, state, pseudo, condition, ancestor }: FoldTarget): string => {
  if (!ancestor) {
    const selector = `.${className}${state ? `:${state}` : ''}${pseudo ? `::${pseudo}` : ''}`;

    return condition ? `${selector} (${condition})` : selector;
  }

  const variant = ancestor.variant ? `[data-variant="${ancestor.variant}"]` : '';

  return `.${ancestor.className}${variant}${ancestor.state ? `:${ancestor.state}` : ''} .${className}`;
};

/** A part — the class itself, a pseudo-element, a condition — with `rules` added to it, or to one of its states. */
const withPartRules = <Part extends StyleStateBlock>(
  part: Part,
  state: StyleState | undefined,
  rules: StyleObject
): Part =>
  state
    ? { ...part, states: { ...part.states, [state]: { ...part.states?.[state], ...rules } } }
    : { ...part, default: { ...part.default, ...rules } };

/** `block` with `rules` added where a folded target says: in a state, a pseudo-element, a condition, or several. */
const withTargetRules = (
  block: StyleBlock,
  { state, pseudo, condition }: FoldTarget,
  rules: StyleObject
): StyleBlock => {
  const holder: StyleCondition = condition ? (block.conditions?.[condition] ?? {}) : block;
  const placed: StyleCondition = pseudo
    ? {
        ...holder,
        pseudos: { ...holder.pseudos, [pseudo]: withPartRules(holder.pseudos?.[pseudo] ?? {}, state, rules) }
      }
    : withPartRules(holder, state, rules);

  return condition ? { ...block, conditions: { ...block.conditions, [condition]: placed } } : { ...block, ...placed };
};

/** `block` with `rules` added under one ancestor condition — always, a state, a variant, or a variant's state. */
const withAncestorRules = (block: StyleBlock, ancestor: FoldAncestor, rules: StyleObject): StyleBlock => {
  const { className, state, variant } = ancestor;
  const conditions: StyleAncestor = block.ancestors?.[className] ?? {};
  let next: StyleAncestor = conditions;
  if (variant) {
    const variantBlock = conditions.variants?.[variant] ?? { default: {} };
    const updated = state
      ? { ...variantBlock, states: { ...variantBlock.states, [state]: { ...variantBlock.states?.[state], ...rules } } }
      : { ...variantBlock, default: { ...variantBlock.default, ...rules } };
    next = { ...conditions, variants: { ...conditions.variants, [variant]: updated } };
  } else if (state) {
    next = { ...conditions, states: { ...conditions.states, [state]: { ...conditions.states?.[state], ...rules } } };
  } else {
    next = { ...conditions, default: { ...conditions.default, ...rules } };
  }

  return { ...block, ancestors: { ...block.ancestors, [className]: next } };
};

// ---------------------------------------------------------------- style
export const indexStyle = (reader: SpecReader, style: Style): void => {
  for (const breakpoint of ['desktop', 'tablet', 'mobile'] as const) {
    for (const [key, item] of Object.entries(style.platform[breakpoint])) {
      if (item.type === 'element') {
        const type = item.componentType ?? item.name;
        const slots = reader.elementBlocks.get(type) ?? {};
        for (const [slot, block] of Object.entries(item.attributes)) {
          (slots[slot] ??= {})[breakpoint] = block;
        }

        reader.elementBlocks.set(type, slots);
        continue;
      }

      // A hover written as a class of its own (`card:hover`), which is how the builder once stored a state. It is
      // the same selector's state today, and folding it in is what makes it editable again.
      const kind: string = item.type;
      if (kind === 'state') {
        const [owner, state] = item.name.split(':');
        const blocks = reader.classBlocks.get(owner) ?? {};
        const block: StyleBlock = blocks[breakpoint] ?? { default: {} };
        block.states = { ...block.states, [state]: { ...item.attributes.base.default } };
        blocks[breakpoint] = block;
        reader.classBlocks.set(owner, blocks);
        correct(reader, 'folded-state-selector', `"${item.name}" is now the ${state} state of "${owner}".`, item.name);
        continue;
      }

      if (item.type !== 'class') {
        correct(
          reader,
          'dropped-selector',
          `The ${item.type} selector "${key}" is not something a space can author.`,
          key
        );
        continue;
      }

      const extraSlots = Object.keys(item.attributes).filter(slot => slot !== 'base');
      if (extraSlots.length > 0) {
        correct(
          reader,
          'dropped-selector',
          `Class "${key}" carried ${extraSlots.join(', ')} parts, which a class does not have; only its base is kept.`,
          key
        );
      }

      const blocks = reader.classBlocks.get(key) ?? {};
      const existing = blocks[breakpoint];
      blocks[breakpoint] = existing
        ? { ...item.attributes.base, states: { ...item.attributes.base.states, ...existing.states } }
        : item.attributes.base;
      reader.classBlocks.set(key, blocks);
    }
  }
};

/**
 * Moves the `customCss` rules a class can hold into the class, and answers the stylesheet that is left.
 *
 * Merged over what the class already says, because that is the cascade it replaces: `customCss` comes after the
 * style's own rules, so where both set a property the custom one is what rendered. Expanded first, so a `padding`
 * written there wins over the longhands the class stores rather than losing to them.
 */
export const foldStylesheet = (reader: SpecReader, stylesheet: string): string => {
  const { folded, remaining } = foldCustomCss(
    stylesheet,
    name => reader.classBlocks.has(name),
    // An ancestor's condition weighs what the class alone does, so the class's own states, variants and smaller
    // breakpoints win over it — where they set the same property, the rule rendered the other way round and stays
    // where it is.
    (target, rules) =>
      !target.ancestor ||
      !Object.keys(css(rules)).some(property => ownConditionProperties(reader, target.className).has(property))
  );
  for (const { targets, rules } of folded) {
    const expanded = css(rules);
    for (const target of targets) {
      const blocks = reader.classBlocks.get(target.className) ?? {};
      const block: StyleBlock = blocks.desktop ?? { default: {} };
      blocks.desktop = target.ancestor
        ? withAncestorRules(block, target.ancestor, expanded)
        : withTargetRules(block, target, expanded);

      reader.classBlocks.set(target.className, blocks);
    }

    correct(
      reader,
      'folded-custom-css',
      `The customCss rule for ${targets.map(target => `"${foldedSelector(target)}"`).join(', ')} is now part of its class.`,
      targets[0]?.className
    );
  }

  return remaining;
};

/** The classes some selector names as an ancestor: a condition reads them by name, so none of them is inlined. */
const ancestorClasses = (reader: SpecReader): Set<string> => {
  reader.ancestorNames ??= new Set(
    [...reader.classBlocks.values(), ...[...reader.elementBlocks.values()].flatMap(slots => Object.values(slots))]
      .flatMap(blocks => Object.values(blocks))
      .flatMap(block => Object.keys(block.ancestors ?? {}))
  );

  return reader.ancestorNames;
};

/**
 * Every property a class sets where it would outweigh a rule folded under an ancestor: its own states and variants,
 * and its tablet and mobile rules, which come later in the stylesheet at the same weight.
 */
const ownConditionProperties = (reader: SpecReader, className: string): Set<string> => {
  const blocks = Object.entries(reader.classBlocks.get(className) ?? {});

  return new Set(
    blocks.flatMap(([breakpoint, block]) => [
      ...(breakpoint === 'desktop' ? [] : Object.keys(block.default ?? {})),
      ...Object.values(block.states ?? {}).flatMap(rules => Object.keys(rules)),
      ...Object.values(block.variants ?? {}).flatMap(variant => [
        ...Object.keys(variant.default ?? {}),
        ...Object.values(variant.states ?? {}).flatMap(rules => Object.keys(rules))
      ])
    ])
  );
};

export const countSelectorUses = (reader: SpecReader, roots: Roots): void => {
  const visit = (element: Element): void => {
    for (const selector of Object.values(element.definition.styleSelectors)) {
      for (const name of selector ? classesOf(selector) : []) {
        reader.selectorUses.set(name, (reader.selectorUses.get(name) ?? 0) + 1);
      }
    }

    childrenOf(reader, element, false).forEach(visit);
  };

  [...componentRoots(roots), ...roots.layouts, ...roots.pages].forEach(visit);
};

const readReporting = (reader: SpecReader, name: string, blocks: SelectorBlocks): ReadSelector => {
  const read = readSelector(blocks);
  if (read.unknownStates.length > 0) {
    correct(
      reader,
      'unknown-style-state',
      `"${name}" had rules for ${read.unknownStates.map(state => `"${state}"`).join(', ')}, which no browser state matches.`,
      name
    );
  }

  return read;
};

const keepUnwritable = (
  reader: SpecReader,
  selector: { name: string; type: 'class' | 'element'; slot?: string },
  unwritable: UnwritableRules,
  mode: Style['mode']
): void => {
  if (isEmpty(unwritable)) {
    return;
  }

  const properties = new Set(
    Object.values(unwritable).flatMap((block: StyleBlock) => [
      ...Object.keys(block.default ?? {}),
      ...Object.values(block.states ?? {}).flatMap(rules => Object.keys(rules)),
      ...Object.values(block.variants ?? {}).flatMap(variant => Object.keys(variant.default ?? {})),
      ...Object.values(block.ancestors ?? {}).flatMap(ancestor => [
        ...Object.values(ancestor.states ?? {}).flatMap(rules => Object.keys(rules)),
        ...Object.values(ancestor.variants ?? {}).flatMap(variant => Object.keys(variant.default ?? {}))
      ])
    ])
  );
  reader.keptCss.push(unwritableCss(selector, unwritable, mode));
  correct(
    reader,
    'unwritable-css',
    `"${selector.name}" set ${[...properties].join(', ')}, which the style editor cannot hold; kept in customCss under the same selector.`,
    selector.name
  );
};

/**
 * How an element's base selector is written: inline, as a class, or not at all.
 *
 * Inline — the element's own `css` — when one element uses it, nothing in the document spells it out (a `customCss`
 * rule, a twig template), and it carries nothing the inline form cannot (a variant, a rule the editor cannot hold).
 * Everything else stays a class under its own name. Inlined, it keeps that name too, as `selector`: authoring would
 * otherwise derive a new one from where the element sits, and the builder, a stylesheet outside the document and
 * the next export all know the element by the old one.
 */
/**
 * An element's base selector as its spec writes it: what a page's or a layout's reads as, and — only an element's —
 * `card hero-bg--own` read back as the class it wears and the rules written on top of it.
 */
export const elementBaseStyle = (
  reader: SpecReader,
  selector: string | undefined,
  elementId: string
): { class?: string | (string | StyleSpec)[]; css?: CssSpec; states?: StatesSpec; selector?: string } => {
  const names = selector ? classesOf(selector) : [];
  const modifier = names.length > 1 ? modifierOf(reader, names[names.length - 1], elementId) : undefined;
  if (!modifier) {
    return baseStyle(reader, selector, 'css-and-states');
  }

  const kept = keepClassList(reader, names.slice(0, -1));

  return { class: [...(kept === undefined ? [] : Array.isArray(kept) ? kept : [kept]), modifier] };
};

export const baseStyle = (
  reader: SpecReader,
  selector: string | undefined,
  inline: 'css' | 'css-and-states'
): { class?: string | string[]; css?: CssSpec; states?: StatesSpec; selector?: string } => {
  if (!selector) {
    return {};
  }

  const names = classesOf(selector);
  if (names.length > 1) {
    const kept = keepClassList(reader, names);

    return kept ? { class: kept } : {};
  }

  // A selector with no entry holds no rules — authoring names one for every element, styled or not — so it
  // reads as nothing at all rather than as something missing.
  const blocks = reader.classBlocks.get(selector);
  if (!blocks) {
    return {};
  }

  const read = readSelector(blocks);
  const canInline =
    (reader.selectorUses.get(selector) ?? 0) === 1 &&
    !reader.references.has(selector) &&
    !ancestorClasses(reader).has(selector) &&
    !read.variants &&
    !read.ancestors &&
    !read.pseudos &&
    !read.conditions &&
    isEmpty(read.unwritable) &&
    (inline === 'css-and-states' || !read.states);

  if (!canInline) {
    reader.keptClasses.add(selector);

    return { class: selector };
  }

  readReporting(reader, selector, blocks);

  return {
    ...(read.css ? { css: read.css } : {}),
    ...(read.states ? { states: read.states } : {}),
    selector
  };
};

/**
 * The rules a `<id>--own` class holds, as the inline object that wrote it — when it is that element's alone and reads
 * back whole; otherwise nothing, and it stays a class like any other.
 */
const modifierOf = (reader: SpecReader, name: string, ownerId: string): StyleSpec | undefined => {
  const blocks = reader.classBlocks.get(name);
  if (name !== modifierClassName(ownerId) || !blocks || (reader.selectorUses.get(name) ?? 0) !== 1) {
    return undefined;
  }

  const read = readSelector(blocks);
  if (
    reader.references.has(name) ||
    read.variants ||
    read.ancestors ||
    read.pseudos ||
    read.conditions ||
    !isEmpty(read.unwritable)
  ) {
    return undefined;
  }

  readReporting(reader, name, blocks);
  if (!read.states) {
    return read.css ?? {};
  }

  return { ...(read.css ? { css: read.css } : {}), states: read.states };
};

/**
 * The classes of a selector that names several, every one kept as a class.
 *
 * None of them can become rules of the element's own: an element has one base selector, and these are shared by
 * definition. One the style document does not declare holds no rules, so it is left out — and said, because a
 * name somebody wrote on an element is not a name that goes missing quietly.
 */
export const keepClassList = (reader: SpecReader, names: string[]): string | string[] | undefined => {
  const kept = names.filter(name => {
    if (reader.classBlocks.has(name)) {
      reader.keptClasses.add(name);

      return true;
    }

    correct(
      reader,
      'dropped-selector',
      `The class "${name}" in "${names.join(' ')}" is not declared by the style document, so it is left out.`,
      name
    );

    return false;
  });

  if (kept.length === 0) {
    return undefined;
  }

  return kept.length === 1 ? kept[0] : kept;
};

/** Every class the space keeps, in the order the style document lists them — including ones nothing names. */
export const classesSpec = (reader: SpecReader, mode: Style['mode']): Record<string, StyleSpec> => {
  const out: Record<string, StyleSpec> = {};
  for (const [name, blocks] of reader.classBlocks) {
    const inlined = (reader.selectorUses.get(name) ?? 0) > 0 && !reader.keptClasses.has(name);
    if (inlined) {
      continue;
    }

    const read = readReporting(reader, name, blocks);
    keepUnwritable(reader, { name, type: 'class' }, read.unwritable, mode);
    out[name] = read.spec ?? {};
  }

  return out;
};

export const readElementDefaults = (reader: SpecReader, mode: Style['mode']): NonNullable<SpaceSpec['elements']> => {
  const out: NonNullable<SpaceSpec['elements']> = {};
  for (const [type, slots] of reader.elementBlocks) {
    // An element type dressed only in a slot has no base block at all.
    const read = readReporting(reader, type, Object.hasOwn(slots, 'base') ? slots.base : {});
    keepUnwritable(reader, { name: type, type: 'element' }, read.unwritable, mode);

    const others = Object.entries(slots).filter(([slot]) => slot !== 'base');
    const slotSpecs = others.flatMap(([slot, blocks]) => {
      const slotRead = readReporting(reader, `${type} ${slot}`, blocks);
      keepUnwritable(reader, { name: type, type: 'element', slot }, slotRead.unwritable, mode);

      return slotRead.spec ? [[slot, slotRead.spec] as const] : [];
    });

    out[type] = {
      ...(read.css ? { base: read.css } : {}),
      ...(read.states ? { states: read.states } : {}),
      ...(read.variants ? { variants: read.variants } : {}),
      ...(read.ancestors ? { ancestors: read.ancestors } : {}),
      ...(read.pseudos ? { pseudos: read.pseudos } : {}),
      ...(read.conditions ? { conditions: read.conditions } : {}),
      ...(slotSpecs.length > 0 ? { slots: Object.fromEntries(slotSpecs) } : {})
    };
  }

  return out;
};

export const pageStyle = (
  reader: SpecReader,
  selector: string | undefined
): { class?: string | string[]; css?: CssSpec; selector?: string } => {
  const style = baseStyle(reader, selector, 'css');

  return {
    ...(style.class ? { class: style.class } : {}),
    ...(style.css ? { css: style.css } : {}),
    ...(style.selector ? { selector: style.selector } : {})
  };
};
