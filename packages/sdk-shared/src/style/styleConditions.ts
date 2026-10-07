/**
 * The conditions a class's rules can hold under that are not the element's own — what the visitor asked of their
 * machine, how wide the box around it is — and the at-rule each one is written as.
 *
 * Breakpoints are conditions too, but of the whole page and of every class at once, so they stay where they are (one
 * block per breakpoint). These belong to one class: written inside it, under every breakpoint it has.
 *
 * - `motion-reduce` — the visitor asked for less motion. The SDK already stills every animation and transition for them;
 *   what is left for a class is what moves WITHOUT animating — a hover that lifts a card, a parallax offset.
 * - `motion-safe` — the visitor did not: motion as an enhancement, written only for whoever wants it.
 * - `container (max-width: 30rem)` — the nearest ancestor that is a container (`container-type: inline-size` on its
 *   class) is at most that wide; `container sidebar (min-width: 480px)` asks the one named `sidebar` (`container-name`).
 *   Widths only — `min-width`, `max-width` or both joined by `and` — in px, rem, em or ch.
 */
export const MOTION_CONDITIONS = {
  'motion-reduce': '@media (prefers-reduced-motion: reduce)',
  'motion-safe': '@media (prefers-reduced-motion: no-preference)'
} as const;

export type MotionCondition = keyof typeof MOTION_CONDITIONS;

/** The condition keys that are not a container query, as the editor offers them. */
export const STYLE_MOTION_CONDITIONS = Object.keys(MOTION_CONDITIONS) as MotionCondition[];

export const STYLE_CONDITION_LABELS: Record<MotionCondition, string> = {
  'motion-reduce': 'Reduced motion',
  'motion-safe': 'Motion allowed'
};

const isMotionCondition = (key: string): key is MotionCondition => Object.hasOwn(MOTION_CONDITIONS, key);

const LENGTH = String.raw`\d+(?:\.\d+)?(?:px|rem|em|ch)`;
const FEATURE = String.raw`\((?:min|max)-width:\s*${LENGTH}\)`;
const CONTAINER_CONDITION = new RegExp(
  String.raw`^container(?:\s+(?<name>-?[_a-zA-Z][\w-]*))?\s+(?<query>${FEATURE}(?:\s+and\s+${FEATURE})?)$`
);

/** A container condition taken apart: the container it asks (none for the nearest), and its width query. */
export const parseContainerCondition = (key: string): { name: string | undefined; query: string } | undefined => {
  const match = CONTAINER_CONDITION.exec(key.trim());
  if (!match?.groups) {
    return undefined;
  }

  return {
    name: match.groups.name,
    query: match.groups.query.replace(/\s+/g, ' ').replace(/\(\s*/g, '(').replace(/:\s*/g, ': ')
  };
};

/**
 * A condition in the one spelling the document keeps — `container card (max-width: 30rem)`, one space where a space
 * goes — so the same condition written twice is one key, or `undefined` for a key that is not a condition.
 */
export const canonicalCondition = (key: string): string | undefined => {
  if (isMotionCondition(key)) {
    return key;
  }

  const container = parseContainerCondition(key);
  if (!container) {
    return undefined;
  }

  return container.name ? `container ${container.name} ${container.query}` : `container ${container.query}`;
};

export const isStyleCondition = (key: string): boolean =>
  isMotionCondition(key) || parseContainerCondition(key) !== undefined;

/** The at-rule a condition is written as, or `undefined` for a key that is not one. */
export const conditionAtRule = (key: string): string | undefined => {
  if (isMotionCondition(key)) {
    return MOTION_CONDITIONS[key];
  }

  const container = parseContainerCondition(key);
  if (!container) {
    return undefined;
  }

  return container.name ? `@container ${container.name} ${container.query}` : `@container ${container.query}`;
};

/** A condition as the editor shows it: its label, or the container query as it is written. */
export const conditionLabel = (key: string): string => (isMotionCondition(key) ? STYLE_CONDITION_LABELS[key] : key);

/**
 * The condition an at-rule's prelude states, when it is one a class can hold — `@media (prefers-reduced-motion:
 * reduce)` is `motion-reduce`, `@container card (max-width: 30rem)` is `container card (max-width: 30rem)` — read
 * back from a stylesheet that wrote it by hand.
 */
export const conditionOfAtRule = (prelude: string): string | undefined => {
  const written = prelude
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .replace(/:\s*/g, ': ');
  for (const [key, atRule] of Object.entries(MOTION_CONDITIONS)) {
    if (written === atRule) {
      return key;
    }
  }

  const container = /^@container\s+(.*)$/.exec(written);
  if (!container) {
    return undefined;
  }

  return canonicalCondition(`container ${container[1]}`);
};
