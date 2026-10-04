import { CHECKS } from './checks';
import { QA_CHECKS, QA_FINDING_ATTRIBUTE, QA_PAGE_ATTRIBUTE } from './qaSettings';
import { XRAY, XRAY_ATTRIBUTE, XRAY_MARKS } from './xray';

import type { QaCheck, QaSettings, VisionMode } from './qaSettings';
import type { XrayFilter } from './xray';

/**
 * The rules the QA tab adds to the document, from what it has on — scoped to the page's box, so the dev tools' own
 * panel is never outlined, paused or filtered with it.
 */

const PAGE = `[${QA_PAGE_ATTRIBUTE}]`;

/** Leaves whose words can carry a name tag without moving anything they hold. */
const NAMED =
  ':is([data-type="heading"], [data-type="text"], [data-type="paragraph"], [data-type="button"], [data-type="link"])';

/** Every element's box, and its type and id over it while pointed at. */
const BOXES = `
${PAGE} [data-plitzi-el] { outline: 1px dashed rgba(124, 92, 255, 0.5); outline-offset: -1px; }
${PAGE} [data-plitzi-el]:hover { outline: 1.5px solid #7c5cff; outline-offset: -1.5px; }
${PAGE} ${NAMED}[data-plitzi-el]:hover { position: relative; }
${PAGE} ${NAMED}[data-plitzi-el]:hover::after {
  content: attr(data-type) ' · ' attr(data-plitzi-el);
  position: absolute;
  left: -1px;
  bottom: 100%;
  z-index: 2147483000;
  padding: 1px 6px;
  border-radius: 4px 4px 0 0;
  background-color: #7c5cff;
  color: #ffffff;
  font: 500 10px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0;
  text-transform: none;
  white-space: nowrap;
  pointer-events: none;
}`;

/**
 * Every element's box, and what carries the wiring asked for in the colour of its mark. Rules last win, so the marks
 * come after the boxes and in reverse: an element with several is drawn in the first of them, the order the tab lists
 * them in.
 */
const xray = (filter: XrayFilter): string =>
  [
    BOXES,
    ...XRAY_MARKS.filter(mark => filter === 'all' || filter === mark)
      .reverse()
      .map(
        mark =>
          `${PAGE} [${XRAY_ATTRIBUTE}~="${mark}"] { outline: 1.5px solid ${XRAY[mark].colour}; outline-offset: -1.5px; }`
      )
  ].join('\n');

/** While inspecting, every element of the page answers the pointer as something to pick, not to use. */
const INSPECTING = `${PAGE}, ${PAGE} * { cursor: crosshair !important; }`;

const PAUSED = `${PAGE} *, ${PAGE} ::before, ${PAGE} ::after { animation-play-state: paused !important; }`;

const findings = (checks: QaCheck[]): string =>
  checks
    .map(
      check =>
        `${PAGE} [${QA_FINDING_ATTRIBUTE}~="${check}"] { outline: 2px solid ${CHECKS[check].colour} !important; outline-offset: 1px !important; box-shadow: 0 0 0 4px color-mix(in srgb, ${CHECKS[check].colour} 22%, transparent) !important; }`
    )
    .join('\n');

/** The id of the SVG filter a vision mode needs, for the ones a CSS function cannot say. */
export const visionFilterId = (mode: VisionMode): string => `plitzi-qa-${mode}`;

/** How each mode is drawn on the page's box. */
export const VISION_FILTER: Record<VisionMode, string> = {
  none: 'none',
  grayscale: 'grayscale(1)',
  protanopia: `url(#${visionFilterId('protanopia')})`,
  deuteranopia: `url(#${visionFilterId('deuteranopia')})`,
  tritanopia: `url(#${visionFilterId('tritanopia')})`,
  blurred: 'blur(2px)'
};

/**
 * The colour matrices of the three dichromacies, as an SVG `feColorMatrix` takes them — the widely used approximations
 * of how each sees, good enough to ask whether two states of a page can be told apart.
 */
export const VISION_MATRIX: Record<'protanopia' | 'deuteranopia' | 'tritanopia', string> = {
  protanopia: '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0',
  deuteranopia: '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0',
  tritanopia: '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0'
};

/** The rules for what is on; empty when nothing that needs a rule is. */
export const qaCss = (settings: QaSettings): string => {
  const checks = QA_CHECKS.filter(check => settings.checks[check]);

  return [
    settings.inspect ? INSPECTING : '',
    settings.xray ? xray(settings.xrayFilter) : '',
    settings.paused ? PAUSED : '',
    settings.vision === 'none' ? '' : `${PAGE} { filter: ${VISION_FILTER[settings.vision]}; }`,
    findings(checks)
  ]
    .filter(Boolean)
    .join('\n');
};
