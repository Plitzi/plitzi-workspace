import { eachNode, enclosingNames, isPlainString, placeOf } from '../ast';
import { finding } from '../catalog';

import type { LintFinding, Rule } from '../types';

/** A hex colour, standing alone in a CSS value — not an anchor (`#plans`), not part of a word or an entity. */
const HEX = /(?<![\w#&/])#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})(?![\w-])/gi;

const FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^()]*\)/gi;

/** Names a colour property is commonly given, in a value that is nothing else. */
const NAMED = new Set([
  'white',
  'black',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'silver',
  'navy',
  'teal',
  'maroon',
  'olive',
  'lime',
  'aqua',
  'cyan',
  'magenta',
  'fuchsia',
  'brown',
  'gold'
]);

/** A property whose value is a colour and nothing else, in either spelling: `color`, `backgroundColor`, `border-color`. */
const COLOUR_PROPERTY =
  /^(?:color|fill|stroke|background|accent-?color|caret-?color|(?:background|border|outline|text-?decoration)-?colou?r)$/i;

/** Where a colour is DECLARED: a token's value per scheme, the space's variables, the meta colour a browser paints. */
const DECLARES = /^(?:light|dark|default|variables|tokens|themeColor|theme-color)$/i;

/**
 * A key whose value names a place rather than paints one — `#plans` is an anchor, `#fff` there is not a colour — or
 * an alpha mask, whose black is how much shows through rather than a colour anybody sees.
 */
const PLACE = /^(?:href|anchor|to|url|src|link|path|target|hash|selector|id)$|mask/i;

/** What the string says, when it paints: the colours in it. */
const coloursIn = (text: string, key: string | undefined): string[] => {
  if (text.includes('<') || /^(?:https?:|\/|\.)/.test(text)) {
    return [];
  }

  if (key !== undefined && PLACE.test(key)) {
    return [];
  }

  const found = [...new Set([...(text.match(HEX) ?? []), ...(text.match(FUNCTION) ?? [])])];
  if (found.length === 0 && key !== undefined && COLOUR_PROPERTY.test(key) && NAMED.has(text.trim().toLowerCase())) {
    return [text.trim()];
  }

  return found;
};

export const colourNotToken: Rule = ({ ts, files }) =>
  files.flatMap(source => {
    const found: LintFinding[] = [];
    eachNode(ts, source.sourceFile, node => {
      if (!isPlainString(ts, node) || ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) {
        return;
      }

      const names = enclosingNames(ts, node);
      const key = ts.isPropertyAssignment(node.parent) && node.parent.initializer === node ? names[0] : undefined;
      if (names.some(name => DECLARES.test(name) || /mask/i.test(name))) {
        return;
      }

      const colours = coloursIn(node.text, key);
      if (colours.length === 0) {
        return;
      }

      found.push(
        finding(
          'colour-not-token',
          `${colours.map(colour => `\`${colour}\``).join(', ')} written out: make it a token of the space, in the file that declares them — a \`light\` and a \`dark\` value, or one value when it must stay the same in both schemes — and say \`var(--name)\` here (\`tokens(variables)\` names them typed).`,
          placeOf(source, node)
        )
      );
    });

    return found;
  });
