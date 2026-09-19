import { css, STYLE_STATES } from '../style';

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
 * Only the top level is read, with a scanner that knows strings, comments and nesting and nothing more: this decides
 * what can be folded, it does not interpret CSS, and whatever it does not recognise is kept as text.
 */

/** One rule that folds into classes: the rules to add to each named class, per state. */
export interface FoldedRule {
  targets: { className: string; state: StyleState | undefined }[];
  rules: CssProps;
}

export interface CustomCssFold {
  folded: FoldedRule[];
  /** The stylesheet without the folded rules, and without the comment each one carried. */
  remaining: string;
}

type Segment = { kind: 'rule'; selector: string; body: string; text: string } | { kind: 'other'; text: string };

const STATE_SET = new Set<string>(STYLE_STATES);

const QUOTES = new Set(['"', '\'']);

const isStyleState = (state: string): state is StyleState => STATE_SET.has(state);

/** Splits at `separator` where it is not inside a string, a comment or brackets. */
const splitTopLevel = (text: string, separator: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = '';
      }

      continue;
    }

    if (QUOTES.has(char)) {
      quote = char;
    } else if (char === '(' || char === '[') {
      depth += 1;
    } else if (char === ')' || char === ']') {
      depth -= 1;
    } else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(text.slice(start));

  return parts;
};

/** The stylesheet as top-level segments: plain rules, and everything else (comments, at-rules, space) as text. */
const segmentsOf = (stylesheet: string): Segment[] => {
  const segments: Segment[] = [];
  let index = 0;
  let pending = '';
  while (index < stylesheet.length) {
    if (stylesheet.startsWith('/*', index)) {
      const end = stylesheet.indexOf('*/', index + 2);
      const stop = end === -1 ? stylesheet.length : end + 2;
      pending += stylesheet.slice(index, stop);
      index = stop;
      continue;
    }

    const open = stylesheet.indexOf('{', index);
    if (open === -1) {
      pending += stylesheet.slice(index);
      break;
    }

    // Everything up to the brace is the prelude; a comment inside it is not something this scanner reads through.
    const prelude = stylesheet.slice(index, open);
    if (prelude.includes('/*')) {
      const comment = stylesheet.indexOf('/*', index);
      pending += stylesheet.slice(index, comment);
      index = comment;
      continue;
    }

    let depth = 1;
    let cursor = open + 1;
    let quote = '';
    for (; cursor < stylesheet.length && depth > 0; cursor += 1) {
      const char = stylesheet[cursor];
      if (quote) {
        if (char === '\\') {
          cursor += 1;
        } else if (char === quote) {
          quote = '';
        }
      } else if (QUOTES.has(char)) {
        quote = char;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
      }
    }

    const leading = prelude.match(/^\s*/)?.[0] ?? '';
    const selector = prelude.trim();
    const text = stylesheet.slice(index + leading.length, cursor);
    if (pending || leading) {
      segments.push({ kind: 'other', text: pending + leading });
      pending = '';
    }

    segments.push(
      selector.startsWith('@')
        ? { kind: 'other', text }
        : { kind: 'rule', selector, body: stylesheet.slice(open + 1, cursor - 1), text }
    );
    index = cursor;
  }

  if (pending) {
    segments.push({ kind: 'other', text: pending });
  }

  return segments;
};

const SIMPLE_SELECTOR = /^\.([A-Za-z_][\w-]*)(?::([a-z-]+))?$/;

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
 * (`.card`, `.card:hover`, `.btn:focus-visible`), and every declaration is one the editor can hold. The comment written
 * directly above a folded rule goes with it: it described a rule that is now a class's own.
 */
export const foldCustomCss = (stylesheet: string, isClass: (name: string) => boolean): CustomCssFold => {
  const segments = segmentsOf(stylesheet);
  const folded: FoldedRule[] = [];
  const kept: string[] = [];
  for (const segment of segments) {
    if (segment.kind === 'other') {
      kept.push(segment.text);
      continue;
    }

    const targets = splitTopLevel(segment.selector, ',').map(part => {
      const match = SIMPLE_SELECTOR.exec(part.trim());
      if (!match || !isClass(match[1])) {
        return undefined;
      }

      const className = match[1];
      // `at` rather than an index: a group that took no part in the match is undefined, which only `at` says.
      const state = match.at(2);
      if (state === undefined) {
        return { className, state: undefined };
      }

      return isStyleState(state) ? { className, state } : undefined;
    });
    const rules = declarationsOf(segment.body);
    if (!rules || targets.some(target => target === undefined)) {
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

  const remaining = kept
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { folded, remaining: remaining ? `${remaining}\n` : '' };
};
