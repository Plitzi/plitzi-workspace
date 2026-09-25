import type { MapQuake } from './geo';

/**
 * The parts of the map that are markup rather than paint: the lock-on reticle, the shockwave an arriving event throws
 * out, the range labels, the tooltip.
 *
 * They are DOM on purpose. A WebGL layer can draw a ring, but it cannot run a CSS animation, honour
 * `prefers-reduced-motion`, or be restyled by the space — and these are exactly the pieces a space wants to restyle.
 * Each one is built from `seismic__*` classes whose look lives in `SeismicMap.css`, in the space's colours.
 *
 * Text is always set with `textContent`: every string here came from a public feed, and a place name is not markup.
 */

const node = (tag: keyof HTMLElementTagNameMap, className: string, text?: string): HTMLElement => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
};

/**
 * The lock-on: four brackets that close in on the event, a crosshair that reaches past them, a ring that keeps
 * pulsing, and a tag with what was locked.
 *
 * `--seismic-band` carries the event's depth colour into the CSS, so the reticle wears the same colour as the dot it
 * sits on — the one thing about it that is data rather than chrome.
 */
export const reticle = (quake: MapQuake): HTMLElement => {
  const root = node('div', `seismic__reticle seismic__reticle--${quake.band}`);
  root.setAttribute('aria-hidden', 'true');
  root.append(
    node('span', 'seismic__reticle-pulse'),
    node('span', 'seismic__reticle-cross'),
    ...['nw', 'ne', 'sw', 'se'].map(corner =>
      node('span', `seismic__reticle-bracket seismic__reticle-bracket--${corner}`)
    )
  );

  const tag = node('div', 'seismic__reticle-tag');
  tag.append(
    node('span', 'seismic__reticle-code', 'TARGET LOCK'),
    node('span', 'seismic__reticle-magnitude', quake.magnitudeLabel),
    node('span', 'seismic__reticle-where', quake.coordinates)
  );
  root.append(tag);

  return root;
};

/** An event that arrived while somebody was watching: three rings that run outward and are gone in four seconds. */
export const shockwave = (band: string, strong: boolean): HTMLElement => {
  const root = node('div', `seismic__shock seismic__shock--${band}${strong ? ' seismic__shock--strong' : ''}`);
  root.setAttribute('aria-hidden', 'true');
  root.append(
    node('span', 'seismic__shock-ring'),
    node('span', 'seismic__shock-ring'),
    node('span', 'seismic__shock-ring')
  );

  return root;
};

/** How long a shockwave lives, matching its CSS animation — the element is removed when it is over. */
export const SHOCKWAVE_MS = 4200;

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** A contour's intensity, on the Modified Mercalli scale's own numerals. */
export const shakingLabel = (mmi: number): HTMLElement => {
  const label = node('span', 'seismic__mmi', ROMAN[Math.min(12, Math.max(1, Math.round(mmi)))]);
  label.dataset.mmi = String(Math.round(mmi));

  return label;
};

export const ringLabel = (distanceKm: number): HTMLElement =>
  node('span', 'seismic__ring-label', `${distanceKm.toLocaleString('en-US')} KM`);

export const tooltip = (quake: MapQuake): HTMLElement => {
  const root = node('div', 'seismic__tip-body');
  root.append(
    node('span', 'seismic__tip-magnitude', quake.magnitudeLabel),
    node('span', 'seismic__tip-region', quake.region),
    node('span', 'seismic__tip-meta', `${quake.depthLabel} deep`)
  );

  return root;
};
