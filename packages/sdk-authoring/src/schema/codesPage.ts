import { AUTHORING_CODES } from './codes';

import type { AuthoringCodeEntry } from './codes';

const INTRO = `# When \`authorSpace\` refuses, warns or suggests

<!-- Generated from AUTHORING_CODES (src/schema/codes.ts) by \`yarn generate:authoring-errors\`. Do not edit. -->

Search this page for the code in brackets — \`[class-and-css]\` — rather than reading it whole, or ask for one:
\`npx @plitzi/cli explain class-and-css\`.

\`authorSpace\` reports everything it cannot write in one run, as a \`SpaceRefusedError\` whose \`refusals\` each carry
a \`code\`, the line of your code that wrote the element (\`src/site/home.ts:417\`) and the nearest named element
(\`"store-footer" › container[1]\`). **Do what the message says.** Never cast past a check, silence it, or move the
logic into a plugin to avoid it — the check exists because that declaration renders something other than what it says.

The one exception is a TEST fixture whose subject is the break itself — how the runtime copes with a document no author
would write. It names that break, and only that one: \`authorSpace(spec, { allow: [{ code, element, why }] })\`. See
[testing](testing.md#spaces-written-for-a-test). A space anybody visits never has an \`allow\`.

More on a topic: [templates](templates.md), [feature flags](feature-flags.md), [accessibility](accessibility.md),
[components](components.md), [flows](flows.md).`;

const STRUCTURE = `## UPPER_CASE codes

\`ORPHANED_ELEMENT\`, \`DUPLICATE_ELEMENT_ID\`, \`BROKEN_FLOW_LINK\` and the rest of the UPPER_CASE codes come from the
documents' own structure — what \`validateSchema\` checks of any schema. Authoring derives every id, parent link and
flow chain, so only a hand-written or hand-edited JSON has them: author it instead (see
[snippets and export](snippets-and-export.md) to turn a JSON into code).`;

const cell = (text: string): string => text.replaceAll('|', '\\|');

/**
 * Every code of one kind as a Markdown table — code, what was wrong, what to write instead — for any page that explains
 * them: the skill's `authoring-errors.md` and the website's both render it, so neither can miss a code.
 */
export const authoringCodesTable = (kind: AuthoringCodeEntry['kind']): string => {
  const rows = Object.entries(AUTHORING_CODES)
    .filter(([, entry]) => entry.kind === kind)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, entry]) => `| \`${code}\` | ${cell(entry.means)} | ${cell(entry.fix)} |`);

  // A suggestion is not something wrong: its row is the long way it was written, and the short way.
  const head =
    kind === 'suggested'
      ? '| Code | Written the long way | The short way |'
      : '| Code | What was wrong | Write instead |';

  return [head, '| --- | --- | --- |', ...rows].join('\n');
};

/** The skill's `authoring-errors.md`, from the table every refusal and warning is raised with. */
export const authoringErrorsPage = (): string =>
  [
    INTRO,
    '## Refused',
    'The space is not written until these are fixed.',
    authoringCodesTable('refused'),
    '## Warned',
    'The space renders, and renders something you probably did not mean. Fix every one.',
    authoringCodesTable('warned'),
    '## Suggested',
    'Nothing is wrong: the page renders as written. Each is a shorter way to the same page — fewer elements, less CSS — ' +
      'and `authorSpace` returns them in `suggestions`, the ones that save the most first. Take them: a space written the ' +
      'short way is the one an editor, an agent and the next person can read. More in [efficiency](efficiency.md).',
    authoringCodesTable('suggested'),
    STRUCTURE
  ].join('\n\n') + '\n';
