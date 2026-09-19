import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import processSelector from '@plitzi/sdk-style/helpers/processSelector';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import { BREAKPOINTS, css, expandShorthand, STYLE_STATES } from '../style';

import type { AncestorSpec, CssProps, CssSpec, RuleSetSpec, StatesSpec, StyleSpec, VariantSpec } from '../style';
import type {
  DisplayMode,
  Style,
  StyleBlock,
  StyleItem,
  StyleObject,
  StyleState,
  StyleStates
} from '@plitzi/sdk-shared';

/**
 * Reading a selector back into the shape an author writes it in.
 *
 * The document stores a selector as one block per breakpoint, each with its rules, its states and its variants. An
 * author writes the same thing inside out — the rules once, per breakpoint only where they differ — so this turns
 * the first into the second, and sets aside whatever the authoring surface would refuse to write.
 */

/** A selector's blocks, by breakpoint, as the style document holds them. */
export type SelectorBlocks = Partial<Record<DisplayMode, StyleBlock>>;

/** What a selector said that the authoring surface cannot: properties outside the vocabulary, by breakpoint. */
export type UnwritableRules = Partial<Record<DisplayMode, StyleBlock>>;

export interface ReadSelector {
  /** The whole selector as one spec: plain CSS when that says everything, the object form when not. */
  spec: StyleSpec | undefined;
  css: CssSpec | undefined;
  states: StatesSpec | undefined;
  variants: Record<string, CssSpec | VariantSpec> | undefined;
  ancestors: Record<string, AncestorSpec> | undefined;
  unwritable: UnwritableRules;
  /** State names the document carries that no browser state matches. Dropped: nothing ever matched them. */
  unknownStates: string[];
}

const STATE_SET = new Set<string>(STYLE_STATES);

const isStyleState = (state: string): state is StyleState => STATE_SET.has(state);

const isEmpty = (value: object | undefined): boolean => !value || Object.keys(value).length === 0;

/**
 * Splits one rule set into what {@link css} accepts and what it refuses, one property at a time.
 *
 * A property the style editor has no control for still renders — it is in the published CSS — so dropping it would
 * change the page. Handing it back lets the caller keep it where plain CSS belongs.
 */
const splitRules = (rules: StyleObject | undefined): { writable: CssProps; unwritable: CssProps } => {
  const writable: CssProps = {};
  const unwritable: CssProps = {};
  for (const [property, value] of Object.entries(rules ?? {})) {
    if (value === '') {
      continue;
    }

    try {
      css({ [property]: value });
      writable[property] = value;
    } catch {
      unwritable[property] = value;
    }
  }

  return { writable, unwritable };
};

/** Shorthands worth writing back, each with the longhands it stands for — all of them, or it is not written. */
const SHORTHANDS: readonly (readonly [string, readonly string[]])[] = [
  ['padding', ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']],
  ['margin', ['margin-top', 'margin-right', 'margin-bottom', 'margin-left']],
  [
    'border-radius',
    ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius']
  ],
  ['border-width', ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width']],
  ['border-style', ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style']],
  ['border-color', ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color']],
  ['gap', ['row-gap', 'column-gap']]
];

/**
 * The shortest box notation for a set of sides — `10px`, `10px 20px`, `10px 20px 30px` or all four — in CSS order.
 *
 * A pair of values (a gap: row then column) has only the two forms.
 */
const boxNotation = (values: string[]): string => {
  if (values.length === 2) {
    return values[0] === values[1] ? values[0] : values.join(' ');
  }

  const [top, right, bottom, left] = values;
  if (right === left) {
    if (top === bottom) {
      return top === right ? top : `${top} ${right}`;
    }

    return `${top} ${right} ${bottom}`;
  }

  return values.join(' ');
};

/**
 * The longhands the document stores, written back as the shorthand a person would have written — `padding: 10px
 * 20px` rather than four declarations — wherever every side is set.
 *
 * Only when expanding the shorthand again gives back exactly those longhands, which is also what keeps a value with
 * a space in it (`calc()`, `rgb()`) written out: the expander would read it as more than one value.
 */
const compact = (rules: CssProps): CssProps => {
  let out: CssProps = { ...rules };
  for (const [shorthand, longhands] of SHORTHANDS) {
    const values = longhands.map(longhand => (Object.hasOwn(out, longhand) ? String(out[longhand]) : undefined));
    if (values.some(value => value === undefined || value === '' || /\s/.test(value))) {
      continue;
    }

    const notation = boxNotation(values.map(String));
    const expanded = expandShorthand({ [shorthand]: notation });
    if (longhands.some((longhand, index) => String(expanded[longhand]) !== values[index])) {
      continue;
    }

    // A single value keeps the type it was written with — `700`, not `'700'`.
    const value = notation === values[0] ? out[longhands[0]] : notation;

    // At the position of the first longhand, so the rules still read in the order they were written.
    const entries = Object.entries(out);
    const at = entries.findIndex(([property]) => longhands.includes(property));
    const rest = entries.filter(([property]) => !longhands.includes(property));
    rest.splice(at, 0, [shorthand, value]);
    out = Object.fromEntries(rest);
  }

  return out;
};

/** Per-breakpoint rules as the tersest {@link CssSpec}: flat when only desktop speaks, keyed by breakpoint when not. */
const toCssSpec = (perBreakpoint: Partial<Record<DisplayMode, CssProps>>): CssSpec | undefined => {
  const present = BREAKPOINTS.filter(breakpoint => !isEmpty(perBreakpoint[breakpoint]));
  if (present.length === 0) {
    return undefined;
  }

  if (present.length === 1 && present[0] === 'desktop') {
    return compact(perBreakpoint.desktop ?? {});
  }

  return Object.fromEntries(present.map(breakpoint => [breakpoint, compact(perBreakpoint[breakpoint] ?? {})]));
};

interface BlockReader {
  rules: Partial<Record<DisplayMode, CssProps>>;
  states: Map<StyleState, Partial<Record<DisplayMode, CssProps>>>;
  unwritable: UnwritableRules;
  unknownStates: Set<string>;
}

const newReader = (): BlockReader => ({ rules: {}, states: new Map(), unwritable: {}, unknownStates: new Set() });

const readBlock = (
  reader: BlockReader,
  breakpoint: DisplayMode,
  block: Omit<StyleBlock, 'variants' | 'ancestors'>,
  park: (breakpoint: DisplayMode, part: 'default' | StyleState, rules: CssProps) => void
): void => {
  const base = splitRules(block.default);
  reader.rules[breakpoint] = base.writable;
  if (!isEmpty(base.unwritable)) {
    park(breakpoint, 'default', base.unwritable);
  }

  for (const [state, rules] of Object.entries(block.states ?? {})) {
    if (!isStyleState(state)) {
      reader.unknownStates.add(state);
      continue;
    }

    const split = splitRules(rules);
    if (!isEmpty(split.writable)) {
      const perBreakpoint = reader.states.get(state) ?? {};
      perBreakpoint[breakpoint] = split.writable;
      reader.states.set(state, perBreakpoint);
    }

    if (!isEmpty(split.unwritable)) {
      park(breakpoint, state, split.unwritable);
    }
  }
};

const statesOf = (reader: BlockReader): StatesSpec | undefined => {
  const entries = [...reader.states].flatMap(([state, perBreakpoint]) => {
    const spec = toCssSpec(perBreakpoint);

    return spec ? [[state, spec] as const] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const parkInto =
  (unwritable: UnwritableRules, variant?: string, ancestor?: string) =>
  (breakpoint: DisplayMode, part: 'default' | StyleState, rules: CssProps): void => {
    const block: StyleBlock = unwritable[breakpoint] ?? { default: {} };
    const scope: { states?: StyleStates; variants?: StyleBlock['variants'] } = ancestor
      ? ((block.ancestors ??= {})[ancestor] ??= {})
      : block;
    const target: { default?: StyleObject; states?: StyleStates } = variant
      ? ((scope.variants ??= {})[variant] ??= { default: {} })
      : scope;

    if (part === 'default') {
      target.default = { ...target.default, ...rules };
    } else {
      target.states = { ...target.states, [part]: { ...target.states?.[part], ...rules } };
    }

    unwritable[breakpoint] = block;
  };

const variantsOf = (readers: Map<string, BlockReader>): Record<string, CssSpec | VariantSpec> | undefined => {
  const specs = [...readers].map(([name, reader]): [string, CssSpec | VariantSpec] => {
    const variantCss = toCssSpec(reader.rules);
    const variantStates = statesOf(reader);

    return [
      name,
      variantStates ? { ...(variantCss ? { css: variantCss } : {}), states: variantStates } : (variantCss ?? {})
    ];
  });

  return specs.length > 0 ? Object.fromEntries(specs) : undefined;
};

interface AncestorReader {
  base: BlockReader;
  variants: Map<string, BlockReader>;
}

/** One selector's blocks, read back into the shape an author writes. */
export const readSelector = (blocks: SelectorBlocks): ReadSelector => {
  const base = newReader();
  const variantReaders = new Map<string, BlockReader>();
  const ancestorReaders = new Map<string, AncestorReader>();

  for (const breakpoint of BREAKPOINTS) {
    const block = blocks[breakpoint];
    if (!block) {
      continue;
    }

    readBlock(base, breakpoint, block, parkInto(base.unwritable));
    for (const [name, variantBlock] of Object.entries(block.variants ?? {})) {
      const reader = variantReaders.get(name) ?? newReader();
      readBlock(reader, breakpoint, variantBlock, parkInto(base.unwritable, name));
      variantReaders.set(name, reader);
    }

    for (const [ancestor, ancestorBlock] of Object.entries(block.ancestors ?? {})) {
      const readers = ancestorReaders.get(ancestor) ?? { base: newReader(), variants: new Map<string, BlockReader>() };
      readBlock(
        readers.base,
        breakpoint,
        { states: ancestorBlock.states },
        parkInto(base.unwritable, undefined, ancestor)
      );
      for (const [name, variantBlock] of Object.entries(ancestorBlock.variants ?? {})) {
        const reader = readers.variants.get(name) ?? newReader();
        readBlock(reader, breakpoint, variantBlock, parkInto(base.unwritable, name, ancestor));
        readers.variants.set(name, reader);
      }

      ancestorReaders.set(ancestor, readers);
    }
  }

  const baseCss = toCssSpec(base.rules);
  const states = statesOf(base);
  const variants = variantsOf(variantReaders);
  const ancestorSpecs = [...ancestorReaders].flatMap(([name, readers]): [string, AncestorSpec][] => {
    const ancestorStates = statesOf(readers.base);
    const ancestorVariants = variantsOf(readers.variants);

    return ancestorStates || ancestorVariants
      ? [
          [
            name,
            {
              ...(ancestorStates ? { states: ancestorStates } : {}),
              ...(ancestorVariants ? { variants: ancestorVariants } : {})
            }
          ]
        ]
      : [];
  });
  const ancestors = ancestorSpecs.length > 0 ? Object.fromEntries(ancestorSpecs) : undefined;
  const ruleSet: RuleSetSpec = {
    ...(baseCss ? { css: baseCss } : {}),
    ...(states ? { states } : {}),
    ...(variants ? { variants } : {}),
    ...(ancestors ? { ancestors } : {})
  };
  const readers = [
    base,
    ...variantReaders.values(),
    ...[...ancestorReaders.values()].flatMap(({ base: ancestorBase, variants: ancestorVariants }) => [
      ancestorBase,
      ...ancestorVariants.values()
    ])
  ];

  return {
    spec: states || variants || ancestors ? ruleSet : baseCss,
    css: baseCss,
    states,
    variants,
    ancestors,
    unwritable: base.unwritable,
    unknownStates: [...new Set(readers.flatMap(reader => [...reader.unknownStates]))]
  };
};

/**
 * The rules the authoring surface refused, as plain CSS for `customCss` — under the SAME selector, per breakpoint.
 *
 * Written by the functions that write the style cache, so a rule kept here renders exactly where it rendered before:
 * the same selector, the same state and variant syntax, the same media query around a tablet or mobile rule.
 */
export const unwritableCss = (
  selector: { name: string; type: StyleItem['type']; slot?: string },
  unwritable: UnwritableRules,
  mode: Style['mode']
): string => {
  const platform: Style['platform'] = { desktop: {}, tablet: {}, mobile: {} };
  for (const breakpoint of BREAKPOINTS) {
    const block = unwritable[breakpoint];
    if (!block) {
      continue;
    }

    const item: StyleItem = {
      name: selector.name,
      type: selector.type,
      ...(selector.type === 'element' ? { componentType: selector.name } : {}),
      attributes: selector.slot ? { base: { default: {} }, [selector.slot]: block } : { base: block },
      cache: ''
    };
    item.cache = processSelector(item);
    platform[breakpoint][selector.name] = item;
  }

  return generateCache({ ...EMPTY_STYLE_SCHEMA, mode, platform, variables: {} });
};
