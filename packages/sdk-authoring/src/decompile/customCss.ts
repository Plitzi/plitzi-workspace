import { conditionOfAtRule } from '@plitzi/sdk-shared/style/styleConditions';
import {
  CONTENT_PSEUDOS,
  GENERATED_PSEUDOS,
  isContentValue,
  isStylePseudo,
  pseudoHonours
} from '@plitzi/sdk-shared/style/stylePseudos';
import { stateSuffix } from '@plitzi/sdk-shared/style/styleStates';

import { css, STYLE_STATES } from '../style';
import { splitTopLevel, stylesheetSegments } from '../style/stylesheet';

import type { CssProps } from '../style';
import type { StylePseudo, StyleState } from '@plitzi/sdk-shared';

/**
 * Finding the rules in a space's `customCss` that a class could have said itself.
 *
 * A rule on `.card:hover`, or one setting a property the style editor now has a control for, only lives in `customCss`
 * because it was written before the class could hold it — and there it cannot be read back, edited per breakpoint or
 * seen in the style inspector. Such a rule is folded into its class — its states, its pseudo-elements, and the
 * conditions a class can hold (`@media (prefers-reduced-motion: reduce)`, `@container (max-width: 30rem)`); everything
 * else — other at-rules, combinators, a selector naming no class the space has — is left exactly as it was written.
 *
 * Only the top level is read (`stylesheetSegments`): this decides what can be folded, it does not interpret CSS, and
 * whatever it does not recognise is kept as text.
 */

/** The condition an ancestor sets on a rule: `.card:hover .icon`, `.sidebar[data-variant='collapsed'] .label`. */
export interface FoldAncestor {
  className: string;
  state: StyleState | undefined;
  variant: string | undefined;
}

/**
 * Where one selector of a folded rule lands: a class, in one of its states, as one of its pseudo-elements, under a
 * condition of the page, or under an ancestor's condition.
 */
export interface FoldTarget {
  className: string;
  state: StyleState | undefined;
  pseudo?: StylePseudo;
  condition?: string;
  ancestor?: FoldAncestor;
}

/** One rule that folds into classes: the rules to add to each named class, per state. */
export interface FoldedRule {
  targets: FoldTarget[];
  rules: CssProps;
}

export interface CustomCssFold {
  folded: FoldedRule[];
  /** The stylesheet without the folded rules, and without the comment each one carried. */
  remaining: string;
}

// Every state a rule can name but `hidden`, which is the SDK's own class rather than anything a selector chooses
// (`.panel:hidden` is no CSS, and not the hidden state either).
const STATE_SET = new Set<string>(STYLE_STATES.filter(state => state !== 'hidden'));

/** The states a selector writes as something other than their name — `:first-child`, `:nth-child(odd)`, `current`. */
const WRITTEN_STATES = [...STATE_SET].filter(state => stateSuffix(state) !== `:${state}`);

/**
 * The `current` state as a selector writes it: the whole of it, as the style compiler does, or one of the attributes it
 * stands for — `[aria-current='page']` on a nav link, `[aria-pressed='true']` on a toggle, `[aria-selected='true']` on a
 * tab — in either quotes. The chosen one of a set carries one of them, so a rule on any of them is the class's current
 * state.
 */
const CURRENT_ATTRIBUTES = /\[aria-current=(["'])page\1\]|\[aria-(?:pressed|selected)=(["'])true\2\]/g;

/** The `expanded` state in either quotes: `[aria-expanded='true']`. */
const EXPANDED_ATTRIBUTE = /\[aria-expanded=(["'])true\1\]/g;

/** Every way of writing a state, written as the state it is (`:first`, `:current`), so one pattern reads every state. */
const asStateNames = (selector: string): string =>
  WRITTEN_STATES.reduce((written, state) => written.replaceAll(stateSuffix(state), `:${state}`), selector)
    .replaceAll(CURRENT_ATTRIBUTES, ':current')
    .replaceAll(EXPANDED_ATTRIBUTE, ':expanded');

const isStyleState = (state: string): state is StyleState => STATE_SET.has(state);

const STATE_THEN_PSEUDO = /^(?::([a-z-]+))?(?:::([a-z-]+))?$/;

/**
 * What follows a part in a selector — `:hover`, `::placeholder`, `[aria-pressed='true']::after`, or nothing — read as
 * the state and the pseudo-element a class says them with; `undefined` when it is anything more, which a class cannot
 * say: another step (`pre code`), a pseudo-class that is no state (`:first-of-type`, `:not(:disabled)`).
 */
export const stateAndPseudoOf = (written: string): { state?: StyleState; pseudo?: StylePseudo } | undefined => {
  const match = STATE_THEN_PSEUDO.exec(asStateNames(written));
  if (!match) {
    return undefined;
  }

  const state = match.at(1);
  const pseudo = match.at(2);
  if ((state !== undefined && !isStyleState(state)) || (pseudo !== undefined && !isStylePseudo(pseudo))) {
    return undefined;
  }

  return { state, pseudo };
};

const SIMPLE_SELECTOR = /^\.([A-Za-z_][\w-]*)(?::([a-z-]+))?(?:::([a-z-]+))?$/;

// `.ancestor[data-variant="x"]:state .class` — the ancestor alone, with a variant, a state or both, and one
// descendant class
const ANCESTOR_SELECTOR =
  /^\.([A-Za-z_][\w-]*)(?:\[data-variant=(["']?)([\w-]+)\2\])?(?::([a-z-]+))?\s+\.([A-Za-z_][\w-]*)$/;

const targetOf = (written: string, isClass: (name: string) => boolean): FoldTarget | undefined => {
  const selector = asStateNames(written);
  const simple = SIMPLE_SELECTOR.exec(selector);
  if (simple) {
    const className = simple[1];
    // `at` rather than an index: a group that took no part in the match is undefined, which only `at` says.
    const state = simple.at(2);
    const pseudo = simple.at(3);
    if (!isClass(className) || (state !== undefined && !isStyleState(state))) {
      return undefined;
    }

    if (pseudo === undefined) {
      return { className, state };
    }

    return isStylePseudo(pseudo) ? { className, state, pseudo } : undefined;
  }

  const nested = ANCESTOR_SELECTOR.exec(selector);
  if (!nested) {
    return undefined;
  }

  const ancestorClass = nested[1];
  const variant = nested.at(3);
  const state = nested.at(4);
  const className = nested[5];
  if (!isClass(ancestorClass) || !isClass(className) || (state !== undefined && !isStyleState(state))) {
    return undefined;
  }

  return { className, state: undefined, ancestor: { className: ancestorClass, state, variant } };
};

/** The declarations of a rule body, or `undefined` when one of them is something a class cannot hold. */
const declarationsOf = (body: string): CssProps | undefined => {
  if (body.includes('{') || body.includes('/*')) {
    return undefined;
  }

  const rules: CssProps = {};
  for (const declaration of splitTopLevel(body, ';')) {
    if (!declaration.trim()) {
      continue;
    }

    const colon = declaration.indexOf(':');
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (colon === -1 || !property || !value || /!important/i.test(value)) {
      return undefined;
    }

    try {
      css({ [property]: value });
    } catch {
      return undefined;
    }

    rules[property] = value;
  }

  return Object.keys(rules).length > 0 ? rules : undefined;
};

/**
 * Whether a pseudo-element's rules draw what they say once they are the class's: every property one the browser honours
 * there, and a `content` CSS can read. A rule that does not is left in `customCss`, where it was written and does exactly
 * what it did.
 */
const pseudoHolds = (pseudo: StylePseudo, rules: CssProps): boolean =>
  Object.entries(rules).every(([property, value]) =>
    property === 'content'
      ? CONTENT_PSEUDOS.includes(pseudo) && isContentValue(String(value))
      : pseudoHonours(pseudo, property)
  );

/** Where a pseudo-element's rules land, its state aside: the class, the pseudo-element and the condition. */
const pseudoKey = ({ className, pseudo, condition }: FoldTarget): string =>
  `${className}::${pseudo ?? ''}@${condition ?? ''}`;

/**
 * Whether every `before`/`after` a folded rule writes is drawn once it is the class's: one written with no state that
 * says its `content`, among the rules folding with it. A state's rules alone — a hover moving an arrow drawn elsewhere —
 * would leave the class a pseudo-element with no content, which authoring refuses; such a rule stays where it is.
 */
const drawnPseudos = (folded: FoldedRule[]): ((rule: FoldedRule) => boolean) => {
  const drawn = new Set(
    folded.flatMap(({ targets, rules }) =>
      Object.hasOwn(rules, 'content') ? targets.filter(target => !target.state).map(pseudoKey) : []
    )
  );

  return ({ targets }) =>
    targets.every(
      target => !target.pseudo || !GENERATED_PSEUDOS.includes(target.pseudo) || drawn.has(pseudoKey(target))
    );
};

/** One rule's targets and declarations, or `undefined` when any of it is something a class cannot hold. */
const ruleFold = (
  selector: string,
  body: string,
  isClass: (name: string) => boolean,
  accepts: (target: FoldTarget, rules: CssProps) => boolean,
  condition?: string
): FoldedRule | undefined => {
  const targets = splitTopLevel(selector, ',').map(part => targetOf(part.trim(), isClass));
  const rules = declarationsOf(body);
  if (!rules) {
    return undefined;
  }

  const placed: FoldTarget[] = [];
  for (const target of targets) {
    if (!target || (condition && target.ancestor) || (target.pseudo && !pseudoHolds(target.pseudo, rules))) {
      return undefined;
    }

    const conditioned = condition ? { ...target, condition } : target;
    if (!accepts(conditioned, rules)) {
      return undefined;
    }

    placed.push(conditioned);
  }

  return { targets: placed, rules };
};

/**
 * The rules in `stylesheet` that fold into a class the space declares, and what is left of the stylesheet without them.
 *
 * A rule folds when every selector in it is a class of this space, alone or with one state the style editor has
 * (`.card`, `.card:hover`, `.btn:focus-visible`), a pseudo-element (`.link::after`, `.link:hover::after`), or under a
 * condition of an ancestor class (`.card:hover .icon`, `.sidebar[data-variant='collapsed'] .label`), and every
 * declaration is one the editor can hold. `accepts` can turn
 * a target down still — the caller knows what the class already says. The comment written directly above a folded
 * rule goes with it: it described a rule that is now a class's own.
 */
export const foldCustomCss = (
  stylesheet: string,
  isClass: (name: string) => boolean,
  accepts: (target: FoldTarget, rules: CssProps) => boolean = () => true
): CustomCssFold => {
  const segments = stylesheetSegments(stylesheet);
  // What each segment would fold into, before deciding: whether a pseudo-element is drawn reads the whole stylesheet.
  const candidates = segments.map(segment => {
    if (segment.kind === 'other') {
      return undefined;
    }

    // A condition folds whole or not at all: every rule inside it a class's own, or the at-rule stays as written.
    const condition = segment.kind === 'atRule' ? conditionOfAtRule(segment.prelude) : undefined;
    if (segment.kind === 'atRule' && !condition) {
      return undefined;
    }

    const rules =
      segment.kind === 'rule'
        ? [ruleFold(segment.selector, segment.body, isClass, accepts)]
        : stylesheetSegments(segment.body)
            .filter(part => part.kind !== 'other' || part.text.trim())
            .map(part =>
              part.kind === 'rule' ? ruleFold(part.selector, part.body, isClass, accepts, condition) : undefined
            );

    return rules.length > 0 && rules.every(rule => rule !== undefined) ? rules : undefined;
  });
  const drawn = drawnPseudos(candidates.flatMap(rules => rules ?? []));
  const folded: FoldedRule[] = [];
  const kept: string[] = [];
  for (const [index, segment] of segments.entries()) {
    const rules = candidates[index];
    if (!rules?.every(drawn)) {
      kept.push(segment.text);
      continue;
    }

    folded.push(...rules);
    // The comment that sat on top of it, and nothing before that.
    const previous = kept.at(-1);
    if (previous !== undefined) {
      kept[kept.length - 1] = previous.replace(/\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*$/, '\n\n');
    }
  }

  // Nothing moved, nothing to tidy: the stylesheet goes back exactly as it was written, whitespace included, or a
  // space read back and authored again would differ from itself by a line break.
  if (folded.length === 0) {
    return { folded, remaining: stylesheet };
  }

  const remaining = kept
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { folded, remaining: remaining ? `${remaining}\n` : '' };
};
