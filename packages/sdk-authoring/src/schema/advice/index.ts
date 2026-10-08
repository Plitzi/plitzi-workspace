import { suggestContent } from './content';
import { suggestCustomCss } from './customCss';
import { suggestCustomCssSlots } from './customCssSlots';
import { suggestDeclarations } from './declarations';
import { suggestMotion } from './motion';
import { suggestPluginHosts } from './pluginHosts';
import { suggestRepeats } from './repeats';

import type { Suggestion } from './types';
import type { Schema, Style } from '@plitzi/sdk-shared';

export { suggestClassOverrides } from './classOverrides';
export { unusedDeclarations } from './declarations';
export type { WornClass, WornList } from './classOverrides';
export type { Suggestion } from './types';

/**
 * What each element quiets (`definition.quiet`): a suggestion about an element written that way on purpose is left
 * out — here, so authoring, the builder's list and the MCP leave out the same ones. The pages' tree and every
 * component's.
 */
const quietCodes = (schema: Schema): Map<string, string[]> =>
  new Map(
    [schema.flat, ...Object.values(schema.components).map(component => component.flat)]
      .flatMap(flat => Object.values(flat))
      .flatMap(element => (element.definition.quiet ? [[element.id, element.definition.quiet] as const] : []))
  );

/**
 * A shorter way to the same page: what a space's documents could say with fewer elements or less CSS — or, for its
 * animations, a lighter one.
 *
 * Not the linter. `lintSpace` reports what renders something other than what was written, and a space is refused or
 * warned for it; nothing here is wrong — the page renders exactly as written. These are the platform's own ways to say
 * it once instead of many times (layouts, components, lists, an element's own `content`, a class's states, the SDK's
 * defaults), to move it cheaply (the compositor's properties), and what it declares and never uses or says twice —
 * offered to whoever wrote it the long way: an agent that did not know them, or a person who has not met them yet.
 * Each names what to write instead, and the ones about elements say how many it saves, which is what they are ranked
 * by.
 */
export const suggestSpace = (
  { schema, style }: { schema: Schema; style: Style },
  {
    stylesheets = [],
    families = [],
    pluginTypes = []
  }: {
    /** The CSS the pages load besides the space's own — its plugins' stylesheets: a token read there is read. */
    stylesheets?: readonly string[];
    /** The pages each `pageFamily` wrote, by id: what they share is written once, never a copy. */
    families?: readonly (readonly string[])[];
    /**
     * The plugin types authoring was handed, as `withPluginCatalogs` lists them: `custom:<type>` for each plugin whose
     * declaration it has — a `custom` element naming one placed it by name.
     */
    pluginTypes?: readonly string[];
  } = {}
): Suggestion[] =>
  withoutQuieted(schema, [
    ...suggestRepeats(schema, style, families),
    ...suggestContent(schema, style),
    ...suggestCustomCss(schema, style),
    ...suggestCustomCssSlots(schema),
    ...suggestMotion(schema, style),
    ...suggestDeclarations(schema, style, stylesheets),
    ...suggestPluginHosts(schema, pluginTypes)
  ]).sort((a, b) => b.saves - a.saves);

/** The suggestions no element they are about quiets — for those read beside the documents, too (authoring's own). */
export const withoutQuieted = (schema: Schema, suggestions: Suggestion[]): Suggestion[] => {
  const quiets = quietCodes(schema);

  return suggestions.filter(
    suggestion => !suggestion.elementIds.some(id => quiets.get(id)?.includes(suggestion.code) === true)
  );
};
