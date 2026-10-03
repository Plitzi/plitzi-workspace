import { findLowContrast } from './contrast';
import { findHeadingGaps } from './headings';
import { findImageScale } from './images';
import { findUnnamed } from './names';
import { findOverflow } from './overflow';
import { findSmallTargets } from './targets';

import type { QaFinding } from './dom';
import type { QaCheck } from '../qaSettings';

export type { QaFinding } from './dom';

/**
 * The QA tab's checks: what a tester looks for by hand on every build, looked for at once on the page as it is drawn.
 * Each is a heuristic over the live DOM, not an audit: it points at what to look at.
 */
export interface CheckSpec {
  label: string;
  description: string;
  /** Its outline on the page, so two findings on one element can still be told apart. */
  colour: string;
  run: (page: Element) => QaFinding[];
}

export const CHECKS: Record<QaCheck, CheckSpec> = {
  overflow: {
    label: 'Sticks out sideways',
    description: 'Whatever reaches past the page’s sides — what makes a phone scroll sideways',
    colour: '#f97316',
    run: findOverflow
  },
  names: {
    label: 'No accessible name',
    description: 'Buttons, links and fields with no words for a screen reader or an agent; pictures with no alt',
    colour: '#e11d48',
    run: findUnnamed
  },
  targets: {
    label: 'Small touch targets',
    description: 'Under 24 × 24 px with another control within reach (WCAG 2.2)',
    colour: '#d97706',
    run: findSmallTargets
  },
  contrast: {
    label: 'Low contrast',
    description: 'Text under 4.5:1 against what is behind it, 3:1 when large (WCAG AA)',
    colour: '#db2777',
    run: findLowContrast
  },
  images: {
    label: 'Image sizes',
    description: 'Pictures stretched past their pixels, or files several times bigger than they are shown',
    colour: '#0891b2',
    run: findImageScale
  },
  headings: {
    label: 'Heading outline',
    description: 'No h1, a second one, or a level skipped on the way down',
    colour: '#7c3aed',
    run: findHeadingGaps
  }
};
