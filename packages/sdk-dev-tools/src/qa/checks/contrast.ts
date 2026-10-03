import { isDrawn, ownTextOf } from './dom';
import { colourReader, contrastRatio, isLargeText, over } from '../inspect/colour';

import type { QaFinding } from './dom';

/**
 * Lines of text below WCAG AA against what is actually behind them: 4.5:1, or 3:1 for large text. Text over a picture
 * or a gradient is left out — its backdrop is pixels this cannot read — and so is text nobody can see.
 */
export const findLowContrast = (page: Element): QaFinding[] => {
  const view = page.ownerDocument.defaultView;
  if (!view) {
    return [];
  }

  const reader = colourReader();

  return [...page.querySelectorAll('*')].flatMap((element): QaFinding[] => {
    if (!ownTextOf(element) || !isDrawn(element)) {
      return [];
    }

    const style = view.getComputedStyle(element);
    if (style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return [];
    }

    const colour = reader.colour(style.color);
    const backdrop = reader.backdrop(element);
    if (!colour || !backdrop) {
      return [];
    }

    const ratio = contrastRatio(over(colour, backdrop), backdrop);
    const needs = isLargeText(parseFloat(style.fontSize), Number(style.fontWeight) || 400) ? 3 : 4.5;
    if (ratio >= needs) {
      return [];
    }

    return [{ check: 'contrast', element, note: `${ratio.toFixed(2)}:1, needs ${String(needs)}:1` }];
  });
};
