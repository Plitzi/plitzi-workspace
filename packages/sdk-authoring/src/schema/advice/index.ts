import { suggestContent } from './content';
import { suggestCustomCss } from './customCss';
import { suggestMotion } from './motion';
import { suggestRepeats } from './repeats';

import type { Suggestion } from './types';
import type { Schema, Style } from '@plitzi/sdk-shared';

export type { Suggestion } from './types';

/**
 * A shorter way to the same page: what a space's documents could say with fewer elements or less CSS — or, for its
 * animations, a lighter one.
 *
 * Not the linter. `lintSpace` reports what renders something other than what was written, and a space is refused or
 * warned for it; nothing here is wrong — the page renders exactly as written. These are the platform's own ways to say
 * it once instead of many times (layouts, components, lists, an element's own `content`, a class's states, the SDK's
 * defaults) or to move it cheaply (the compositor's properties), offered to whoever wrote it the long way: an agent
 * that did not know them, or a person who has not met them yet. Each names what to write instead, and the ones about
 * elements say how many it saves, which is what they are ranked by.
 */
export const suggestSpace = ({ schema, style }: { schema: Schema; style: Style }): Suggestion[] =>
  [
    ...suggestRepeats(schema, style),
    ...suggestContent(schema, style),
    ...suggestCustomCss(schema, style),
    ...suggestMotion(schema, style)
  ].sort((a, b) => b.saves - a.saves);
