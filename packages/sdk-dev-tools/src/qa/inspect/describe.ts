import { backdropOf, contrastRatio, isLargeText, over, toHex, toRgba } from './colour';

/** What a designer asks of an element on the page: what it is, how big, how it is spaced, set and coloured. */
export interface ElementSummary {
  /** `heading · lp-hero-title`, or the tag where the element is not one of the space's. */
  name: string;
  tag: string;
  width: number;
  height: number;
  display: string;
  position: string;
  padding: string;
  margin: string;
  border: string;
  radius: string;
  gap: string;
  font: string;
  lineHeight: string;
  letterSpacing: string;
  colour: string;
  background: string | undefined;
  /** The text against what is behind it, when that can be read — and what it needs to pass AA. */
  contrast: { ratio: number; needs: number } | undefined;
  opacity: string;
  zIndex: string;
  /** The space's own classes: the SDK's wrappers left out. */
  classes: string[];
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** Four sides the way a shorthand writes them: one value when all agree, two when opposite sides do. */
export const sidesOf = (style: CSSStyleDeclaration, property: 'padding' | 'margin'): string => {
  const [top, right, bottom, left] = SIDES.map(side => style.getPropertyValue(`${property}-${side}`) || '0px');
  if (top === right && right === bottom && bottom === left) {
    return top;
  }

  return top === bottom && right === left ? `${top} ${right}` : `${top} ${right} ${bottom} ${left}`;
};

/** The SDK's own wrappers — what every element of a kind carries — are not what a designer named. */
const isOwnClass = (name: string): boolean =>
  !name.startsWith('plitzi-component') && !name.startsWith('plitzi__') && !name.startsWith('devtools-');

const firstFamily = (family: string): string => family.split(',')[0]?.replace(/["']/g, '').trim() ?? family;

export const summarize = (element: Element): ElementSummary | undefined => {
  const view = element.ownerDocument.defaultView;
  if (!view) {
    return undefined;
  }

  const style = view.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const type = element.getAttribute('data-type');
  const id = element.getAttribute('data-plitzi-el');
  const tag = element.tagName.toLowerCase();
  const colour = toRgba(style.color);
  const fill = toRgba(style.backgroundColor);
  const backdrop = backdropOf(element);
  const fontSize = parseFloat(style.fontSize);
  const fontWeight = Number(style.fontWeight) || 400;
  const contrast =
    colour && backdrop
      ? { ratio: contrastRatio(over(colour, backdrop), backdrop), needs: isLargeText(fontSize, fontWeight) ? 3 : 4.5 }
      : undefined;

  return {
    name: type && id ? `${type} · ${id}` : tag,
    tag,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    display: style.display,
    position: style.position,
    padding: sidesOf(style, 'padding'),
    margin: sidesOf(style, 'margin'),
    border: `${style.borderTopWidth} ${style.borderTopStyle}`,
    radius: style.borderTopLeftRadius,
    gap: style.gap === 'normal' ? '' : style.gap,
    font: `${firstFamily(style.fontFamily)} ${style.fontSize} · ${style.fontWeight}`,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    colour: colour ? toHex(colour) : style.color,
    background: fill && fill[3] > 0 ? toHex(fill) : undefined,
    contrast,
    opacity: style.opacity,
    zIndex: style.zIndex,
    classes: [...element.classList].filter(isOwnClass)
  };
};
