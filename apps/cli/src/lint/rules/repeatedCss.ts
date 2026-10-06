import { eachNode, isPlainString, placeOf, propertyName } from '../ast';
import { finding } from '../catalog';

import type { Rule, SourcePlace } from '../types';
import type TypeScript from 'typescript';

/** A look written this many times is a look somebody will change in one place and not the others. */
export const MIN_COPIES = 3;

/** Fewer declarations than this are a value or two that happen to match, not a look. */
const MIN_DECLARATIONS = 3;

/** Properties that say an object is CSS, in camelCase as the factories take them. */
const CSS_PROPERTIES = new Set([
  'alignItems',
  'alignSelf',
  'aspectRatio',
  'background',
  'backgroundColor',
  'border',
  'borderBottom',
  'borderColor',
  'borderRadius',
  'borderTop',
  'bottom',
  'boxShadow',
  'color',
  'columnGap',
  'cursor',
  'display',
  'flex',
  'flexDirection',
  'flexWrap',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'gap',
  'gridTemplateColumns',
  'height',
  'inset',
  'justifyContent',
  'left',
  'letterSpacing',
  'lineHeight',
  'margin',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginTop',
  'maxWidth',
  'minHeight',
  'minWidth',
  'objectFit',
  'opacity',
  'overflow',
  'padding',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'position',
  'right',
  'rowGap',
  'textAlign',
  'textDecoration',
  'textTransform',
  'top',
  'transform',
  'transition',
  'whiteSpace',
  'width',
  'zIndex'
]);

const camel = (key: string): string => key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

const kebab = (key: string): string => key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/** An object of CSS declarations as one text, whatever their order and spelling: `color:var(--fg);display:flex`. */
const declarationsOf = (ts: typeof TypeScript, node: TypeScript.ObjectLiteralExpression): string[] | undefined => {
  const declarations: string[] = [];
  for (const property of node.properties) {
    const key = ts.isPropertyAssignment(property) ? propertyName(ts, property.name) : undefined;
    if (key === undefined || !ts.isPropertyAssignment(property)) {
      return undefined;
    }

    const value = property.initializer;
    if (!isPlainString(ts, value) && !ts.isNumericLiteral(value)) {
      return undefined;
    }

    declarations.push(`${camel(key)}:${value.text.trim()}`);
  }

  const css = declarations.filter(declaration => CSS_PROPERTIES.has(declaration.slice(0, declaration.indexOf(':'))));

  return declarations.length >= MIN_DECLARATIONS && css.length * 2 >= declarations.length
    ? declarations.sort()
    : undefined;
};

export const repeatedCss: Rule = ({ ts, files }) => {
  const copies = new Map<string, { declarations: string[]; places: SourcePlace[] }>();
  for (const source of files) {
    eachNode(ts, source.sourceFile, node => {
      if (!ts.isObjectLiteralExpression(node)) {
        return;
      }

      const declarations = declarationsOf(ts, node);
      if (!declarations) {
        return;
      }

      const key = declarations.join(';');
      const entry = copies.get(key) ?? { declarations, places: [] };
      entry.places.push(placeOf(source, node));
      copies.set(key, entry);
    });
  }

  return [...copies.values()]
    .filter(({ places }) => places.length >= MIN_COPIES)
    .map(({ declarations, places }) => {
      const [first, ...others] = places;
      const properties = declarations.map(declaration => kebab(declaration.slice(0, declaration.indexOf(':'))));
      const where = others.map(place => `${place.file}:${String(place.line)}`).join(', ');

      return finding(
        'repeated-css',
        `The same CSS (${properties.join(', ')}) is written ${String(places.length)} times — here, ${where}: make it one class, \`styles('<role>', { … })\` beside the space's other shared classes, and give it to each element — then the look is changed once, in code or in the builder.`,
        first,
        others
      );
    });
};
