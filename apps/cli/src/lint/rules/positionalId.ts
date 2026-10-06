import { explainList } from '@plitzi/sdk-authoring';

import { eachNode, isPlainString, placeOf, propertyName } from '../ast';
import { finding } from '../catalog';

import type { LintFinding, Rule } from '../types';

/**
 * The names an element is given when nobody names it: `<type>-<n>` written offline, `<type>-<4 letters and digits>` by
 * the builder — the type as a word, then a number or a random run that has a digit in it (so `text-main` is a name).
 */
const positional = (): RegExp => {
  const types = explainList('element')
    .map(entry => entry.name.replace(/[^A-Za-z0-9]/g, ''))
    .join('|');

  return new RegExp(`^(?:${types})-(?:\\d+|(?=[a-z]*\\d)[a-z\\d]{4})$`);
};

export const positionalId: Rule = ({ ts, files }) => {
  const minted = positional();

  return files.flatMap(source => {
    const found: LintFinding[] = [];
    eachNode(ts, source.sourceFile, node => {
      if (
        !ts.isPropertyAssignment(node) ||
        propertyName(ts, node.name) !== 'id' ||
        !isPlainString(ts, node.initializer) ||
        !minted.test(node.initializer.text)
      ) {
        return;
      }

      found.push(
        finding(
          'positional-id',
          `\`${node.initializer.text}\` is a name minted for an element nobody named, and it says nothing of what the element is: name it after its area and role in kebab-case (\`home-hero-title\`) — and rename what refers to it.`,
          placeOf(source, node.initializer)
        )
      );
    });

    return found;
  });
};
