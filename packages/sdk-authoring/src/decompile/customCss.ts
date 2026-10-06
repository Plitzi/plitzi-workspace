import { stateSuffix } from '@plitzi/sdk-shared/style/styleStates';

import { css, STYLE_STATES } from '../style';
import { splitTopLevel, stylesheetSegments } from '../style/stylesheet';

import type { CssProps } from '../style';
import type { StyleState } from '@plitzi/sdk-shared';

/**
 * Finding the rules in a space's `customCss` that a class could have said itself.
 *
 * A rule on `.card:hover`, or one setting a property the style editor now has a control for, only lives in `customCss`
 * because it was written before the class could hold it — and there it cannot be read back, edited per breakpoint or
 * seen in the style inspector. Such a rule is folded into its class; everything else — at-rules, combinators,
 * pseudo-elements, a selector naming no class the space has — is left exactly as it was written.
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

/** Where one selector of a folded rule lands: a class, in one of its states or under an ancestor's condition. */
export interface FoldTarget {
  className: string;
  state: StyleState | undefined;
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

// The states written as a pseudo-class — what `.card:hover` names — and `current`, which a selector names by the
// attributes of the chosen one of a set and `targetOf` reads as `:current`. `.panel:hidden` is no CSS, and not the
// hidden state.
const STATE_SET = new Set<string>(
  STYLE_STATES.filter(state => state === 'current' || stateSuffix(state) === `:${state}`)
);

/**
 * The `current` state as a selector writes it: the whole of it, as the style compiler does, or one of the attributes it
 * stands for — `[aria-current='page']` on a nav link, `[aria-pressed='true']` on a toggle, `[aria-selected='true']` on a
 * tab — in either quotes. The chosen one of a set carries one of them, so a rule on any of them is the class's current
 * state.
 */
const CURRENT_ATTRIBUTES = /\[aria-current=(["'])page\1\]|\[aria-(?:pressed|selected)=(["'])true\2\]/g;

/** Every way of writing the `current` state, written as the state it is, so one pattern reads every state. */
const asStateNames = (selector: string): string =>
  selector.replaceAll(stateSuffix('current'), ':current').replaceAll(CURRENT_ATTRIBUTES, ':current');

const isStyleState = (state: string): state is StyleState => STATE_SET.has(state);

const SIMPLE_SELECTOR = /^\.([A-Za-z_][\w-]*)(?::([a-z-]+))?$/;

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
    if (!isClass(className)) {
      return undefined;
    }

    if (state === undefined) {
      return { className, state: undefined };
    }

    return isStyleState(state) ? { className, state } : undefined;
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
 * The rules in `stylesheet` that fold into a class the space declares, and what is left of the stylesheet without them.
 *
 * A rule folds when every selector in it is a class of this space, alone or with one state the style editor has
 * (`.card`, `.card:hover`, `.btn:focus-visible`), or under a condition of an ancestor class (`.card:hover .icon`,
 * `.sidebar[data-variant='collapsed'] .label`), and every declaration is one the editor can hold. `accepts` can turn
 * a target down still — the caller knows what the class already says. The comment written directly above a folded
 * rule goes with it: it described a rule that is now a class's own.
 */
export const foldCustomCss = (
  stylesheet: string,
  isClass: (name: string) => boolean,
  accepts: (target: FoldTarget, rules: CssProps) => boolean = () => true
): CustomCssFold => {
  const segments = stylesheetSegments(stylesheet);
  const folded: FoldedRule[] = [];
  const kept: string[] = [];
  for (const segment of segments) {
    if (segment.kind !== 'rule') {
      kept.push(segment.text);
      continue;
    }

    const targets = splitTopLevel(segment.selector, ',').map(part => targetOf(part.trim(), isClass));
    const rules = declarationsOf(segment.body);
    if (!rules || targets.some(target => target === undefined || !accepts(target, rules))) {
      kept.push(segment.text);
      continue;
    }

    folded.push({ targets: targets.filter(target => target !== undefined), rules });
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
