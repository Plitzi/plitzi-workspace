import type { CSSProperties } from 'react';

export type QaBoxModelProps = { element: Element };

const px = (value: string): number => parseFloat(value) || 0;

const ring = (colour: string, top: number, right: number, bottom: number, left: number): CSSProperties => ({
  borderStyle: 'solid',
  borderColor: colour,
  borderWidth: `${String(top)}px ${String(right)}px ${String(bottom)}px ${String(left)}px`
});

/**
 * The element's box as a browser's inspector draws it: its margin in orange outside it, its padding in green inside
 * its border, its content in blue.
 */
const QaBoxModel = ({ element }: QaBoxModelProps) => {
  const view = element.ownerDocument.defaultView;
  if (!view) {
    return null;
  }

  const style = view.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const margin = [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft].map(px);
  const border = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(px);
  const padding = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(px);
  // Negative margins pull the element; they are not room around it.
  const [mt, mr, mb, ml] = margin.map(value => Math.max(value, 0));
  const [bt, br, bb, bl] = border;
  const [pt, pr, pb, pl] = padding;

  return (
    <>
      <div
        className="pointer-events-none fixed z-[999997] box-border"
        style={{
          left: rect.left - ml,
          top: rect.top - mt,
          width: rect.width + ml + mr,
          height: rect.height + mt + mb,
          ...ring('rgba(249, 115, 22, 0.32)', mt, mr, mb, ml)
        }}
      />
      <div
        className="pointer-events-none fixed z-[999997] box-border"
        style={{
          left: rect.left + bl,
          top: rect.top + bt,
          width: Math.max(rect.width - bl - br, 0),
          height: Math.max(rect.height - bt - bb, 0),
          backgroundColor: 'rgba(59, 130, 246, 0.24)',
          // The blue is the content only: the green border around it is the padding.
          backgroundClip: 'padding-box',
          ...ring('rgba(34, 197, 94, 0.32)', pt, pr, pb, pl)
        }}
      />
    </>
  );
};

export default QaBoxModel;
