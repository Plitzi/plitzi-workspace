import ListCircles from '@plitzi/plitzi-ui/icons/ListCircles';
import ListDots from '@plitzi/plitzi-ui/icons/ListDots';
import ListLetters from '@plitzi/plitzi-ui/icons/ListLetters';
import ListNumbers from '@plitzi/plitzi-ui/icons/ListNumbers';
import ListRoman from '@plitzi/plitzi-ui/icons/ListRoman';
import ListSquares from '@plitzi/plitzi-ui/icons/ListSquares';
import XMark from '@plitzi/plitzi-ui/icons/XMark';

import type { StyleValue } from '@plitzi/sdk-shared';

/** The markers a list and a list item offer, as icon buttons: `list-style` and `list-style-type` take the same words. */
export const listMarkerItems = (current: StyleValue | undefined) =>
  (
    [
      ['none', <XMark key="none" />],
      ['disc', <ListDots key="disc" />],
      ['circle', <ListCircles key="circle" />],
      ['square', <ListSquares key="square" />],
      ['decimal', <ListNumbers key="decimal" />],
      ['lower-alpha', <ListLetters key="lower-alpha" />],
      ['lower-roman', <ListRoman key="lower-roman" />]
    ] as const
  ).map(([value, icon]) => ({ value, icon, description: '', active: current === value }));
