import { canonicalCondition, STYLE_MOTION_CONDITIONS } from '@plitzi/sdk-shared/style/styleConditions';
import {
  CONTENT_PSEUDOS,
  GENERATED_PSEUDOS,
  isContentValue,
  isStylePseudo,
  PSEUDO_PROPERTIES,
  pseudoHonours,
  STYLE_PSEUDOS
} from '@plitzi/sdk-shared/style/stylePseudos';

import { expandShorthand } from '../../../catalogs';
import { fail } from '../../../helpers';

import type { DefinitionSlotInput, PseudoPartInput } from './shared';
import type { OpResult } from '../../../helpers';
import type { CssProps } from '../../../types';

// What a style write is held to before anything is written — the rules authoring holds a space's code to, said as an
// op error: a pseudo-element the browser has no such thing as, a property it drops there, a `content` that draws
// nothing, a condition no at-rule says. Each would otherwise render as nothing, with no word anywhere.

const MODES = ['desktop', 'tablet', 'mobile'] as const;

const CONDITION_HINT =
  `Use ${STYLE_MOTION_CONDITIONS.join(' or ')}, or a container's width — "container (max-width: 30rem)", ` +
  '"container card (min-width: 480px)" (min-width, max-width or both joined by "and", in px, rem, em or ch).';

/** Every rule set of a part — per breakpoint and in each of its states — as it is stored: longhands. */
const rulesOf = (part: PseudoPartInput): CssProps[] => [
  ...MODES.flatMap(mode => (part[mode] ? [expandShorthand(part[mode])] : [])),
  ...Object.values(part.states ?? {}).flatMap(states =>
    MODES.flatMap(mode => (states[mode] ? [expandShorthand(states[mode])] : []))
  )
];

const pseudoProblem = (path: string, name: string, part: PseudoPartInput): OpResult | null => {
  if (!isStylePseudo(name)) {
    const bare = name.replace(/^:+/, '');

    return fail(
      path,
      `"${name}" is not a pseudo-element a class dresses`,
      isStylePseudo(bare) ? `Write it without the colons: "${bare}".` : `Use one of ${STYLE_PSEUDOS.join(', ')}.`,
      [...STYLE_PSEUDOS]
    );
  }

  const rules = rulesOf(part);
  for (const rule of rules) {
    for (const [property, value] of Object.entries(rule)) {
      if (property === 'content') {
        if (!CONTENT_PSEUDOS.includes(name)) {
          return fail(
            path,
            `content on ::${name} draws nothing`,
            `Only ${CONTENT_PSEUDOS.map(pseudo => `::${pseudo}`).join(', ')} take one.`
          );
        }

        if (!isContentValue(String(value))) {
          return fail(
            path,
            `content: ${String(value)} on ::${name} is not text CSS can read, so nothing is drawn`,
            `Write the text in quotes inside the string — "\\"${String(value)}\\"" — and an empty box as "\\"\\""; counter(), attr() and url() are written as they are.`
          );
        }

        continue;
      }

      if (!pseudoHonours(name, property)) {
        return fail(
          path,
          `${property} on ::${name} is dropped by every browser`,
          `::${name} honours ${(PSEUDO_PROPERTIES[name] ?? []).join(', ')}; style the element itself for the rest.`
        );
      }
    }
  }

  if (GENERATED_PSEUDOS.includes(name) && !rules.some(rule => Object.hasOwn(rule, 'content'))) {
    return fail(
      path,
      `::${name} has no content, so nothing is drawn`,
      'Give it one: content "\\"\\"" for an empty box.'
    );
  }

  return null;
};

const pseudosProblem = (path: string, pseudos: Record<string, PseudoPartInput> | undefined): OpResult | null => {
  for (const [name, part] of Object.entries(pseudos ?? {})) {
    const problem = pseudoProblem(`${path}pseudos.${name}`, name, part);
    if (problem) {
      return problem;
    }
  }

  return null;
};

const slotProblem = (path: string, slot: DefinitionSlotInput): OpResult | null => {
  const own = pseudosProblem(path, slot.pseudos);
  if (own) {
    return own;
  }

  for (const [name, variant] of Object.entries(slot.variants ?? {})) {
    const problem = pseudosProblem(`${path}variants.${name}.`, variant.pseudos);
    if (problem) {
      return problem;
    }
  }

  for (const [key, condition] of Object.entries(slot.conditions ?? {})) {
    if (!canonicalCondition(key)) {
      return fail(
        `${path}conditions.${key}`,
        `"${key}" is not a condition a class's rules can hold under`,
        CONDITION_HINT
      );
    }

    const problem = pseudosProblem(`${path}conditions.${key}.`, condition.pseudos);
    if (problem) {
      return problem;
    }
  }

  return null;
};

/** The first problem with a style write — its base selector, then each slot — or `null` when it can be written. */
export const styleInputProblem = (
  base: DefinitionSlotInput,
  slots: Record<string, DefinitionSlotInput> | undefined
): OpResult | null => {
  const own = slotProblem('', base);
  if (own) {
    return own;
  }

  for (const [name, slot] of Object.entries(slots ?? {})) {
    const problem = slotProblem(`slots.${name}.`, slot);
    if (problem) {
      return problem;
    }
  }

  return null;
};
