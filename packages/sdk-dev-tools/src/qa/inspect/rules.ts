/**
 * The CSS rules that reach an element, as written — the class it wears, its variant, an ancestor's condition, a rule
 * of the space's own CSS — rather than the values they resolved to.
 */

export interface MatchedRule {
  selector: string;
  /** `color: red; padding: 8px`. */
  declarations: string;
  /** The media query it sits under, when there is one. */
  media?: string;
}

/** A selector every element gets — resets and the page's own ground — which says nothing about this one. */
const UNIVERSAL_PART = /^(\*|:root|:host|html|body|::?before|::?after|::backdrop|::?marker)$/;

const isUniversal = (selector: string): boolean => selector.split(',').every(part => UNIVERSAL_PART.test(part.trim()));

/** The dev tools' own marks on the page — the QA tab's rules, a tab's highlight — are not the page's CSS. */
const isOwnTooling = (selector: string): boolean =>
  selector.includes('[data-plitzi-qa') || selector.includes('devtools-element-');

/** A utility framework's private variables, set on everything: what a rule of only those says is nothing. */
const isPlumbing = (style: CSSStyleDeclaration): boolean => [...style].every(property => property.startsWith('--tw-'));

/** The most rules listed: what is past it is resets and inheritance. */
const LIMIT = 60;

/** A nested rule's own selector, with its parent's put in for `&` — as the browser reads it. */
const resolve = (selector: string, parent: string | undefined): string => {
  if (!parent) {
    return selector;
  }

  return selector.includes('&') ? selector.replaceAll('&', `:is(${parent})`) : `:is(${parent}) ${selector}`;
};

const matches = (element: Element, selector: string): boolean => {
  try {
    return element.matches(selector);
  } catch {
    // A selector this engine cannot read — a pseudo-element, a future one — is not a rule it applies.
    return false;
  }
};

const collect = (
  element: Element,
  rules: CSSRuleList,
  found: MatchedRule[],
  parent: string | undefined,
  media: string | undefined
) => {
  const view = element.ownerDocument.defaultView;
  for (const rule of rules) {
    if (found.length >= LIMIT) {
      return;
    }

    if (rule instanceof CSSStyleRule) {
      const selector = resolve(rule.selectorText, parent);
      if (
        rule.style.length > 0 &&
        !isUniversal(rule.selectorText) &&
        !isOwnTooling(rule.selectorText) &&
        !isPlumbing(rule.style) &&
        matches(element, selector)
      ) {
        found.push({ selector: rule.selectorText, declarations: rule.style.cssText, ...(media ? { media } : {}) });
      }

      if (rule.cssRules.length > 0) {
        collect(element, rule.cssRules, found, selector, media);
      }
    } else if (rule instanceof CSSMediaRule) {
      // Where nothing can say whether a query matches, its rules are listed with it rather than lost.
      if (typeof view?.matchMedia !== 'function' || view.matchMedia(rule.media.mediaText).matches) {
        collect(element, rule.cssRules, found, parent, rule.media.mediaText);
      }
    } else if (rule instanceof CSSGroupingRule) {
      // Layers and `@supports`: their rules apply as written.
      collect(element, rule.cssRules, found, parent, media);
    }
  }
};

export const matchedRules = (element: Element): MatchedRule[] => {
  const found: MatchedRule[] = [];
  for (const sheet of element.ownerDocument.styleSheets) {
    try {
      collect(element, sheet.cssRules, found, undefined, undefined);
    } catch {
      // A stylesheet from another origin keeps its rules to itself.
    }
  }

  return found;
};
