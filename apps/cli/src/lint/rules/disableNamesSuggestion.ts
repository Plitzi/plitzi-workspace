import { isSuggestionCode } from '@plitzi/sdk-authoring';

import { finding } from '../catalog';
import { directivesIn } from '../directives';

import type { Rule } from '../types';

/**
 * A `plitzi-lint-disable` comment naming a suggestion of authoring's: a comment silences only this command's own codes,
 * so it silences nothing, and reads as if it did. A suggestion is quieted on the element it is about.
 */
export const disableNamesSuggestion: Rule = ({ files }) =>
  files.flatMap(source =>
    directivesIn(source.text).flatMap(directive =>
      directive.codes === 'all'
        ? []
        : [...directive.codes]
            .filter(isSuggestionCode)
            .map(code =>
              finding(
                'disable-names-suggestion',
                `\`plitzi-lint-disable\` names \`${code}\`, a suggestion of authoring's, which a comment does not silence — it is quieted on the element it is about, where the builder and the MCP read it too: \`quiet: ['${code}']\`.`,
                { file: source.file, line: directive.line, column: directive.column }
              )
            )
    )
  );
