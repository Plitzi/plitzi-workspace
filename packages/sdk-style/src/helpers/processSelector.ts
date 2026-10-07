import { conditionAtRule } from '@plitzi/sdk-shared/style/styleConditions';
import { pseudoSuffix } from '@plitzi/sdk-shared/style/stylePseudos';
import { inCascadeOrder, isParentAncestor, isStartingState, stateSuffix } from '@plitzi/sdk-shared/style/styleStates';

import processSelectorAttributes from './processSelectorAttributes';
import processSelectorName from './processSelectorName';
import processSelectorVariables from './processSelectorVariables';

import type { Attributes, ProcessedAncestors } from './processSelectorAttributes';
import type { StyleItem, StylePseudo } from '@plitzi/sdk-shared';

type Block = Omit<Attributes[string], 'default'>;

const TAB_SIZE = 2;

const getSpaces = (n = TAB_SIZE) => ' '.repeat(n);

const combine = (base: string, media: string[], inline: boolean) =>
  `${inline || !media.length ? base : `${base}\n`}${media.join(inline ? '' : '\n')}`;

const getMediaQueries = (
  name: string,
  variables: { default: string[]; light: string[]; dark: string[] },
  inline = true,
  tab = TAB_SIZE
) => {
  const out: string[] = [];
  const sep = getSpaces(tab);
  const sepMedia = getSpaces(tab + TAB_SIZE);

  for (const mode of ['light', 'dark'] as const) {
    if (!variables[mode].length) {
      continue;
    }

    if (inline) {
      out.push(`@media(prefers-color-scheme:${mode}){${name}{${variables[mode].join('')}}}`);
    } else {
      const body = variables[mode]
        .map(v => `${sepMedia}${v}`)
        .join('\n')
        .replaceAll(':', ': ');

      out.push(`\n@media(prefers-color-scheme: ${mode}) {\n${sep}${name} {\n${body}\n${sep}}\n}`);
    }
  }

  return out;
};

const variantSelector = (base: string, variant: string, state = '') => [
  `${base}[data-variant="${variant}"]${state}`,
  `${base}--${variant}${state}`
];

// `:where()` keeps the rule at the class's own weight: it beats the class's base, and the element's own states and
// variants still beat it. The parent (`>`) is named by nothing but its state, one step up: `:where(:hover) > &`.
const ancestorRules = (ancestors: ProcessedAncestors, inline: boolean, tab: number) => {
  const separator = inline ? ',' : ', ';
  const rules: string[] = [];
  for (const [ancestor, { default: values, states, variants }] of Object.entries(ancestors)) {
    const parent = isParentAncestor(ancestor);
    const base = parent ? '' : `.${ancestor}`;
    const combinator = parent ? ' > &' : ' &';
    const shown = parent ? '*' : base;
    if (values?.length) {
      rules.push(getSelector(`:where(${shown})${combinator}`, values, {}, inline, tab));
    }

    for (const [state, values] of inCascadeOrder(states ?? {})) {
      rules.push(getSelector(`:where(${base}${stateSuffix(state)})${combinator}`, values, {}, inline, tab));
      if (isStartingState(state)) {
        rules.push(startingStyle(`:where(${shown})${combinator}`, values, inline, tab));
      }
    }

    // The parent wears no class, so a variant of it is its `data-variant` alone.
    const variantOf = (variant: string, state = '') =>
      parent ? [`[data-variant="${variant}"]${state}`] : variantSelector(base, variant, state);
    for (const [variant, block] of Object.entries(variants ?? {})) {
      if (block.default.length) {
        const selector = variantOf(variant).join(separator);
        rules.push(getSelector(`:where(${selector})${combinator}`, block.default, {}, inline, tab));
      }

      for (const [state, values] of inCascadeOrder(block.states ?? {})) {
        const selector = variantOf(variant, stateSuffix(state)).join(separator);
        rules.push(getSelector(`:where(${selector})${combinator}`, values, {}, inline, tab));
        if (isStartingState(state)) {
          rules.push(startingStyle(`:where(${variantOf(variant).join(separator)})${combinator}`, values, inline, tab));
        }
      }
    }
  }

  return rules;
};

// A pseudo-element goes last in its selector, after the state that shows it: `&:hover::before`, never the other way.
const pseudoRules = (pseudos: NonNullable<Block['pseudos']>, inline: boolean, tab: number): string[] =>
  (Object.entries(pseudos) as [StylePseudo, NonNullable<NonNullable<Block['pseudos']>[StylePseudo]>][]).flatMap(
    ([pseudo, { default: values, states }]) => {
      const suffix = pseudoSuffix(pseudo);
      const rules: string[] = values.length ? [getSelector(`&${suffix}`, values, {}, inline, tab)] : [];
      for (const [state, stateValues] of inCascadeOrder(states ?? {})) {
        rules.push(getSelector(`&${stateSuffix(state)}${suffix}`, stateValues, {}, inline, tab));
        if (isStartingState(state)) {
          rules.push(startingStyle(`&${suffix}`, stateValues, inline, tab));
        }
      }

      return rules;
    }
  );

// Written last, so a class's rules under a condition win over the same rules outside it at the same weight.
const conditionRules = (
  name: string,
  conditions: NonNullable<Block['conditions']>,
  inline: boolean,
  tab: number
): string[] =>
  Object.entries(conditions).flatMap(([condition, { default: values, states, pseudos }]) => {
    const atRule = conditionAtRule(condition);
    if (!atRule) {
      return [];
    }

    const body: string = attributesToString(name, values, { states, pseudos }, inline, tab);
    if (!body) {
      return [];
    }

    return [inline ? `${atRule}{${body}}` : `${getSpaces(tab)}${atRule} {\n${body}\n${getSpaces(tab)}}`];
  });

const attributesToString = (name: string, attrs: string[], block: Block, inline = true, tab = TAB_SIZE): string => {
  const { states, variants, ancestors, pseudos, conditions } = block;
  const body = inline
    ? attrs.join('')
    : attrs
        .map(a => `${getSpaces(tab + TAB_SIZE)}${a}`)
        .join('\n')
        .replaceAll(':', ': ');

  const stateBlocks: string[] = states
    ? inCascadeOrder(states).flatMap(([state, values]) => {
        const block = getSelector(`&${stateSuffix(state)}`, values, {}, inline, tab + TAB_SIZE);

        return isStartingState(state) ? [block, startingStyle('&', values, inline, tab + TAB_SIZE)] : [block];
      })
    : [];

  const variantBaseName = name.replace('plitzi__', '');
  const variantBlocks: string[] = variants
    ? Object.entries(variants).map(([variant, values]) =>
        getSelector(
          `&[data-variant="${variant}"]${inline ? ',' : ', '}&${variantBaseName}--${variant}`,
          values.default,
          { states: values.states, pseudos: values.pseudos },
          inline,
          tab + TAB_SIZE
        )
      )
    : [];

  const pseudoBlocks = pseudos ? pseudoRules(pseudos, inline, tab + TAB_SIZE) : [];
  const ancestorBlocks = ancestors ? ancestorRules(ancestors, inline, tab + TAB_SIZE) : [];
  const conditionBlocks = conditions ? conditionRules(name, conditions, inline, tab + TAB_SIZE) : [];
  const parts = [stateBlocks, pseudoBlocks, variantBlocks, ancestorBlocks, conditionBlocks];

  if (inline) {
    return `${body}${parts.map(blocks => blocks.join('')).join('')}`;
  }

  const sections = body ? [body] : [];
  for (const blocks of parts) {
    if (blocks.length) {
      sections.push(blocks.join('\n\n'));
    }
  }

  return sections.join('\n\n');
};

// Where the selector starts from as it appears — from `display: none`, or on its first paint — for its transition to
// run from: the rules of a state that is also a starting point (`hidden`), nested so they keep the selector's weight.
const startingStyle = (selector: string, values: string[], inline: boolean, tab: number) =>
  inline
    ? `@starting-style{${getSelector(selector, values, {}, inline, tab)}}`
    : `${getSpaces(tab)}@starting-style {\n${getSelector(selector, values, {}, inline, tab + TAB_SIZE)}\n${getSpaces(tab)}}`;

const getSelector = (name: string, attrs: string[], block: Block, inline = true, tab = TAB_SIZE): string => {
  const body: string = attributesToString(name, attrs, block, inline, tab);

  return inline ? `${name}{${body}}` : `${getSpaces(tab)}${name} {\n${body}\n${getSpaces(tab)}}`;
};

const getElementSelector = (name: string, attributes: Attributes, inline = true, tab = TAB_SIZE) => {
  const parts: string[] = [];
  for (const [styleSelector, block] of Object.entries(attributes)) {
    // Base selector - inline in the root
    if (styleSelector === 'base') {
      const content = attributesToString(name, block.default, block, inline, tab);
      if (content) {
        parts.push(content);
      }

      continue;
    }

    // Sub Selectors
    parts.push(getSelector(`${name}-${styleSelector}`, block.default, block, inline, tab + TAB_SIZE));
  }

  return inline ? `${name}{${parts.join('')}}` : `${name} {\n${parts.join('\n\n')}\n}`;
};

const processSelector = (selector: StyleItem, inline = true) => {
  const name = processSelectorName(selector);
  const vars = processSelectorVariables(selector);

  const processed = processSelectorAttributes(selector);
  const media = vars ? getMediaQueries(name, vars, inline) : undefined;
  if (vars) {
    processed.attributes.base.default.push(...vars.default);
  }

  const css = getElementSelector(name, processed.attributes, inline, 0);

  return media ? combine(css, media, inline) : css;
};

export const processSelectors = (selectors: StyleItem[], inline = false) => {
  return selectors.map(selector => processSelector(selector, inline));
};

export default processSelector;
