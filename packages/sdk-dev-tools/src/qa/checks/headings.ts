import { isDrawn } from './dom';

import type { QaFinding } from './dom';

const levelOf = (element: Element): number => {
  const tag = /^h([1-6])$/i.exec(element.tagName)?.[1];
  if (tag) {
    return Number(tag);
  }

  return Number(element.getAttribute('aria-level')) || 2;
};

/**
 * The page's headings as a reader of an outline meets them: one first-level heading, and no level skipped on the way
 * down — a screen reader and a browser agent find their way by it.
 */
export const findHeadingGaps = (page: Element): QaFinding[] => {
  const headings = [...page.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')].filter(isDrawn);
  if (headings.length === 0) {
    return [];
  }

  const found: QaFinding[] = [];
  const firsts = headings.filter(heading => levelOf(heading) === 1);
  if (firsts.length === 0) {
    found.push({ check: 'headings', element: headings[0], note: 'the page has no h1' });
  }

  firsts.slice(1).forEach(heading => found.push({ check: 'headings', element: heading, note: 'another h1' }));
  headings.forEach((heading, index) => {
    const level = levelOf(heading);
    const previous = index === 0 ? 1 : levelOf(headings[index - 1]);
    if (level > previous + 1) {
      found.push({ check: 'headings', element: heading, note: `h${String(level)} right after h${String(previous)}` });
    }
  });

  return found;
};
