import { classifyBorderTokens } from './border';
import {
  ANIMATION_DIRECTIONS,
  ANIMATION_FILL_MODES,
  ANIMATION_PLAY_STATES,
  FONT_STYLE_KEYWORDS,
  FONT_VARIANT_KEYWORDS,
  FONT_WEIGHT_KEYWORDS,
  isTimingFunction,
  LENGTH_RE,
  LIST_STYLE_POSITIONS,
  LIST_STYLE_TYPES,
  NUMBER_RE,
  splitOn,
  splitPair,
  splitTokens,
  TEXT_DECORATION_LINES,
  TEXT_DECORATION_STYLES,
  TIME_RE
} from './helpers';

import type { CssProps } from '../../types';

// transition, animation and background are comma-separated LAYERS. Each layer expands on its own and the results
// are re-joined per longhand, which is how CSS itself stores them (`transition-property: opacity, transform`) —
// expanding the raw value as one flat token list would scramble the layers into each other.
const expandLayers = (value: string, out: CssProps, expandLayer: (layer: string, out: CssProps) => void): void => {
  const layers = splitOn(value, ',');
  if (layers.length === 1) {
    expandLayer(layers[0], out);

    return;
  }

  const perLayer = layers.map(layer => {
    const layerOut: CssProps = {};
    expandLayer(layer, layerOut);

    return layerOut;
  });

  const keys = new Set(perLayer.flatMap(layer => Object.keys(layer)));
  for (const key of keys) {
    out[key] = perLayer.map(layer => String(layer[key] ?? 'initial')).join(', ');
  }
};

// outline: same token classification as border (width/style/color)
export const expandOutline = (value: string, out: CssProps): void => {
  for (const [kind, token] of Object.entries(classifyBorderTokens(value))) {
    out[`outline-${kind}`] = token;
  }
};

// list-style: tokens classified as type/position/image
export const expandListStyle = (value: string, out: CssProps): void => {
  for (const token of splitTokens(value)) {
    if (token.startsWith('url(')) {
      out['list-style-image'] = token;
    } else if (LIST_STYLE_POSITIONS.has(token)) {
      out['list-style-position'] = token;
    } else if (LIST_STYLE_TYPES.has(token)) {
      out['list-style-type'] = token;
    }
  }
};

// text-decoration: tokens classified as line/color/style
export const expandTextDecoration = (value: string, out: CssProps): void => {
  for (const token of splitTokens(value)) {
    if (TEXT_DECORATION_LINES.has(token)) {
      out['text-decoration-line'] = token;
    } else if (TEXT_DECORATION_STYLES.has(token)) {
      out['text-decoration-style'] = token;
    } else {
      out['text-decoration-color'] = token;
    }
  }
};

// One transition layer: property, then the first time is the duration and the second the delay (CSS order).
const expandTransitionLayer = (layer: string, out: CssProps): void => {
  let foundDuration = false;
  for (const token of splitTokens(layer)) {
    if (isTimingFunction(token)) {
      out['transition-timing-function'] = token;
    } else if (TIME_RE.test(token) || NUMBER_RE.test(token)) {
      if (foundDuration) {
        out['transition-delay'] = token;
      } else {
        out['transition-duration'] = token;
        foundDuration = true;
      }
    } else if (!out['transition-property']) {
      out['transition-property'] = token;
    }
  }
};

export const expandTransition = (value: string, out: CssProps): void => expandLayers(value, out, expandTransitionLayer);

// One animation layer. `normal` and `none` are ambiguous (direction/fill-mode, fill-mode/name), so they are read in
// the order CSS resolves them: the first unclaimed slot wins.
const expandAnimationLayer = (layer: string, out: CssProps): void => {
  let foundDuration = false;
  for (const token of splitTokens(layer)) {
    if (isTimingFunction(token)) {
      out['animation-timing-function'] = token;
    } else if (TIME_RE.test(token)) {
      if (foundDuration) {
        out['animation-delay'] = token;
      } else {
        out['animation-duration'] = token;
        foundDuration = true;
      }
    } else if (token === 'infinite' || NUMBER_RE.test(token)) {
      out['animation-iteration-count'] = token;
    } else if (ANIMATION_DIRECTIONS.has(token) && !out['animation-direction']) {
      out['animation-direction'] = token;
    } else if (ANIMATION_FILL_MODES.has(token) && !out['animation-fill-mode']) {
      out['animation-fill-mode'] = token;
    } else if (ANIMATION_PLAY_STATES.has(token) && !out['animation-play-state']) {
      out['animation-play-state'] = token;
    } else if (!out['animation-name']) {
      out['animation-name'] = token;
    }
  }
};

export const expandAnimation = (value: string, out: CssProps): void => expandLayers(value, out, expandAnimationLayer);

const BACKGROUND_REPEATS = new Set(['repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'space', 'round']);
const BACKGROUND_ATTACHMENTS = new Set(['scroll', 'fixed', 'local']);
const BACKGROUND_BOXES = new Set(['border-box', 'padding-box', 'content-box']);
const BACKGROUND_POSITIONS = new Set(['center', 'top', 'bottom', 'left', 'right']);

const isImage = (token: string): boolean => token.startsWith('url(') || token.includes('-gradient(');

const isPosition = (token: string): boolean => BACKGROUND_POSITIONS.has(token) || LENGTH_RE.test(token);

const isSize = (token: string): boolean =>
  token === 'cover' || token === 'contain' || token === 'auto' || LENGTH_RE.test(token);

// One background layer: `position / size` share a slash, and the box keywords fill origin then clip.
const expandBackgroundLayer = (layer: string, out: CssProps): void => {
  const [beforeSlash, afterSlash] = splitPair(layer, '/');
  const tokens = splitTokens(beforeSlash);
  if (afterSlash !== undefined) {
    // The position is the run of position tokens immediately before the slash…
    let positionStart = tokens.length;
    while (positionStart > 0 && isPosition(tokens[positionStart - 1])) {
      positionStart -= 1;
    }

    const position = tokens.splice(positionStart, tokens.length - positionStart);
    if (position.length > 0) {
      out['background-position'] = position.join(' ');
    }

    // …and only the size values immediately after it; whatever trails those is an ordinary layer token.
    const afterTokens = splitTokens(afterSlash);
    let sizeEnd = 0;
    while (sizeEnd < afterTokens.length && isSize(afterTokens[sizeEnd])) {
      sizeEnd += 1;
    }

    if (sizeEnd > 0) {
      out['background-size'] = afterTokens.slice(0, sizeEnd).join(' ');
    }

    tokens.push(...afterTokens.slice(sizeEnd));
  }

  const positions: string[] = [];
  for (const token of tokens) {
    if (isImage(token)) {
      out['background-image'] = token;
    } else if (BACKGROUND_REPEATS.has(token)) {
      out['background-repeat'] = token;
    } else if (token === 'cover' || token === 'contain') {
      out['background-size'] = token;
    } else if (BACKGROUND_ATTACHMENTS.has(token)) {
      out['background-attachment'] = token;
    } else if (BACKGROUND_BOXES.has(token)) {
      if (out['background-origin']) {
        out['background-clip'] = token;
      } else {
        out['background-origin'] = token;
      }
    } else if (isPosition(token)) {
      positions.push(token);
    } else if (!out['background-color']) {
      out['background-color'] = token;
    }
  }

  if (positions.length > 0) {
    out['background-position'] = positions.join(' ');
  }
};

export const expandBackground = (value: string, out: CssProps): void => expandLayers(value, out, expandBackgroundLayer);

// font: `[style variant weight] size[/line-height] family`. The size is the pivot — everything before it is a
// keyword, everything after it the family.
export const expandFont = (value: string, out: CssProps): void => {
  const [beforeSlash, afterSlash] = splitPair(value, '/');
  const tokens = splitTokens(beforeSlash);
  if (afterSlash !== undefined) {
    const [lineHeight, ...family] = splitTokens(afterSlash);
    out['line-height'] = lineHeight;
    if (family.length > 0) {
      out['font-family'] = family.join(' ');
    }
  }

  const family: string[] = [];
  let foundSize = false;
  for (const token of tokens) {
    if (foundSize) {
      family.push(token);
      continue;
    }

    // `normal` is a legal value of font-style, font-variant AND font-weight, so it fills the first of the three the
    // declaration has not claimed yet — the order CSS itself resolves it in.
    if (token === 'normal') {
      const slot = (['font-style', 'font-variant', 'font-weight'] as const).find(prop => !out[prop]);
      if (slot) {
        out[slot] = token;
      }
    } else if (FONT_STYLE_KEYWORDS.has(token) && !out['font-style']) {
      out['font-style'] = token;
    } else if (FONT_VARIANT_KEYWORDS.has(token) && !out['font-variant']) {
      out['font-variant'] = token;
    } else if (FONT_WEIGHT_KEYWORDS.has(token) && !out['font-weight']) {
      out['font-weight'] = token;
    } else if (LENGTH_RE.test(token)) {
      out['font-size'] = token;
      foundSize = true;
    }
  }

  if (family.length > 0) {
    out['font-family'] = family.join(' ');
  }
};
