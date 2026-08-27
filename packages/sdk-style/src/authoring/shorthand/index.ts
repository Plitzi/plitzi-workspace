import { expandBorder, expandBorderGroup } from './border';
import { expandBorderRadius, expandBox, expandGap } from './box';
import { SIDES } from './helpers';
import {
  expandColumns,
  expandFlex,
  expandFlexFlow,
  expandGridArea,
  expandGridLine,
  expandGridTemplate,
  expandOverflow,
  expandPlacePair
} from './layout';
import {
  expandAnimation,
  expandBackground,
  expandFont,
  expandListStyle,
  expandOutline,
  expandTextDecoration,
  expandTransition
} from './visual';

import type { CssPatch, CssProps } from '../types';

// --- Shorthand expansion ------------------------------------------------------------------------------

type Expander = (key: string, value: string, out: CssProps) => void;

// Every shorthand the authoring surface accepts, mapped to the expander that atomizes it. Plitzi stores one
// property per key so a breakpoint/state/variant can override just that one, so nothing reaches persistence in
// shorthand form.
const EXPANDERS = new Map<string, Expander>([
  ['padding', expandBox],
  ['margin', expandBox],
  ['inset', expandBox],
  ['border-radius', (_key, value, out) => expandBorderRadius(value, out)],
  ['gap', (_key, value, out) => expandGap(value, out)],
  ['border-width', (key, value, out) => expandBorderGroup(key.slice('border-'.length), value, out)],
  ['border-color', (key, value, out) => expandBorderGroup(key.slice('border-'.length), value, out)],
  ['border-style', (key, value, out) => expandBorderGroup(key.slice('border-'.length), value, out)],
  ['border', expandBorder],
  ['overflow', (_key, value, out) => expandOverflow(value, out)],
  ['flex', (_key, value, out) => expandFlex(value, out)],
  ['flex-flow', (_key, value, out) => expandFlexFlow(value, out)],
  ['place-content', (_key, value, out) => expandPlacePair('place-content', value, out)],
  ['place-items', (_key, value, out) => expandPlacePair('place-items', value, out)],
  ['place-self', (_key, value, out) => expandPlacePair('place-self', value, out)],
  ['grid-row', (_key, value, out) => expandGridLine('grid-row', value, out)],
  ['grid-column', (_key, value, out) => expandGridLine('grid-column', value, out)],
  ['grid-area', (_key, value, out) => expandGridArea(value, out)],
  ['grid', (_key, value, out) => expandGridTemplate(value, out)],
  ['grid-template', (_key, value, out) => expandGridTemplate(value, out)],
  ['columns', (_key, value, out) => expandColumns(value, out)],
  ['outline', (_key, value, out) => expandOutline(value, out)],
  ['list-style', (_key, value, out) => expandListStyle(value, out)],
  ['text-decoration', (_key, value, out) => expandTextDecoration(value, out)],
  ['transition', (_key, value, out) => expandTransition(value, out)],
  ['animation', (_key, value, out) => expandAnimation(value, out)],
  ['background', (_key, value, out) => expandBackground(value, out)],
  ['font', (_key, value, out) => expandFont(value, out)]
]);

for (const side of SIDES) {
  EXPANDERS.set(`border-${side}`, expandBorder);
}

/** Every shorthand that is accepted and atomized — advertised to an agent so it knows it may write plain CSS. */
export const cssShorthands: string[] = Array.from(EXPANDERS.keys()).sort();

const expandOne = (key: string, raw: string | number, out: CssProps): boolean => {
  const expand = EXPANDERS.get(key);
  if (!expand) {
    return false;
  }

  // An empty shorthand declares nothing; expanding it would invent longhands with no value. It is still claimed as
  // expanded so the shorthand key itself never reaches persistence.
  const value = String(raw).trim();
  if (value !== '') {
    expand(key, value, out);
  }

  return true;
};

/** Expand supported CSS shorthands to their longhand keys. Explicit longhands in the same map win over any
 *  expansion (so `{ padding: 8, padding-left: 0 }` keeps padding-left: 0). Unrecognized keys pass through. */
export const expandShorthand = (css: CssProps): CssProps => {
  const expanded: CssProps = {};
  const direct: CssProps = {};
  for (const [key, value] of Object.entries(css)) {
    if (!expandOne(key, value, expanded)) {
      direct[key] = value;
    }
  }

  return { ...expanded, ...direct };
};

// --- Patch expansion ----------------------------------------------------------------------------------

// A removal (`null`) names a shorthand but has no value to classify, so the keys it clears are taken from a probe
// expansion of a value that exercises every longhand the shorthand controls.
const REMOVAL_PROBE = new Map<string, string>(
  Object.entries({
    padding: '0',
    margin: '0',
    inset: '0',
    'border-radius': '0 0 0 0 / 0 0 0 0',
    gap: '0 0',
    'border-width': '0 0 0 0',
    'border-color': 'red red red red',
    'border-style': 'solid solid solid solid',
    border: '0 solid red',
    overflow: 'visible visible',
    flex: '0 0 auto',
    'flex-flow': 'row nowrap',
    'place-content': 'start start',
    'place-items': 'start start',
    'place-self': 'start start',
    'grid-row': 'auto / auto',
    'grid-column': 'auto / auto',
    'grid-area': 'auto / auto / auto / auto',
    grid: '"a" 0 / 0',
    'grid-template': '"a" 0 / 0',
    columns: '0 0',
    outline: '0 solid red',
    'list-style': 'disc inside url(x)',
    'text-decoration': 'underline solid red',
    transition: 'all 0s ease 0s',
    animation: 'a 0s ease 0s 1 normal forwards running',
    background: 'red url(x) no-repeat scroll 0 0 / auto padding-box border-box',
    font: 'italic small-caps bold 0px/0 a'
  })
);

for (const side of SIDES) {
  REMOVAL_PROBE.set(`border-${side}`, '0 solid red');
}

/** The longhand keys a shorthand controls — what a `null` patch value has to clear. */
export const shorthandLonghands = (key: string): string[] | undefined => {
  const probe = REMOVAL_PROBE.get(key);
  if (probe === undefined) {
    return undefined;
  }

  const out: CssProps = {};
  expandOne(key, probe, out);

  return Object.keys(out);
};

/** Patch flavour of {@link expandShorthand}: a `null` value removes every longhand the key controls, so
 *  `{ padding: null }` clears all four sides rather than a `padding` key that was never stored. */
export const expandShorthandPatch = (css: CssPatch): CssPatch => {
  const expanded: CssPatch = {};
  const direct: CssPatch = {};
  for (const [key, value] of Object.entries(css)) {
    if (value === null) {
      const longhands = shorthandLonghands(key);
      if (longhands) {
        for (const longhand of longhands) {
          expanded[longhand] = null;
        }
      } else {
        direct[key] = null;
      }

      continue;
    }

    const props: CssProps = {};
    if (expandOne(key, value, props)) {
      Object.assign(expanded, props);
    } else {
      direct[key] = value;
    }
  }

  return { ...expanded, ...direct };
};
