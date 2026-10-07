/**
 * A space's own `@keyframes`: named animations its classes play with `animation-name`.
 *
 * Declared motion (`motion` on an element) covers how an element arrives and the loops it keeps — prefer it where it
 * says what is meant. Keyframes are for the rest: a tab panel sliding in, a caret blinking, a gradient drifting.
 *
 * They are kept in the space's `customCss`, where CSS has always kept them and every surface already loads them, as one
 * block at its top written by {@link keyframesCss} — so an editor, an export or an agent reading the stylesheet sees
 * them as the CSS they are, and {@link splitKeyframesCss} reads that block back as the declarations it came from.
 */

/** One frame's rules: kebab-case longhands, as a class's rules are stored. */
export type KeyframeRules = Record<string, string | number>;

/** A keyframes rule's frames by selector — `from`, `to`, `50%`, `0%, 100%` — in the order they are written. */
export type KeyframesFrames = Record<string, KeyframeRules>;

/** Every keyframes rule a space declares, by name. */
export type SpaceKeyframes = Record<string, KeyframesFrames>;

/** The names the SDK's own stylesheets use (`plitzi-motion-fade`…): a space's keyframes never take one. */
export const SDK_KEYFRAMES_PREFIX = 'plitzi-';

/** A keyframes name CSS accepts unquoted, and not one of the words `animation-name` reads as something else. */
export const isKeyframesName = (name: string): boolean =>
  /^-?[_a-zA-Z][\w-]*$/.test(name) && !['none', 'initial', 'inherit', 'unset', 'revert', 'default'].includes(name);

const FRAME_OFFSET = /^(?:from|to|\d{1,3}(?:\.\d+)?%)$/;

/** Whether a frame selector is one CSS reads: `from`, `to`, a percentage up to 100%, or several of them by commas. */
export const isFrameSelector = (selector: string): boolean =>
  selector.split(',').every(part => {
    const offset = part.trim();

    return FRAME_OFFSET.test(offset) && (!offset.endsWith('%') || Number.parseFloat(offset) <= 100);
  });

const ruleCss = (name: string, frames: KeyframesFrames): string => {
  const body = Object.entries(frames).map(([selector, rules]) => {
    const declarations = Object.entries(rules).map(([property, value]) => `    ${property}: ${String(value)};`);

    return [`  ${selector} {`, ...declarations, '  }'].join('\n');
  });

  return [`@keyframes ${name} {`, ...body, '}'].join('\n');
};

/** The keyframes as the CSS block a space's `customCss` starts with, or `''` when there are none. */
export const keyframesCss = (keyframes: SpaceKeyframes | undefined): string =>
  Object.entries(keyframes ?? {})
    .map(([name, frames]) => ruleCss(name, frames))
    .join('\n\n');

/** The space's custom CSS with its keyframes before it — how a space's `customCss` carries both. */
export const withKeyframesCss = (customCss: string, keyframes: SpaceKeyframes | undefined): string =>
  [keyframesCss(keyframes), customCss].filter(Boolean).join('\n\n');

const RULE = /^@keyframes (-?[_a-zA-Z][\w-]*) \{\n((?: {2}[^\n{}]+ \{\n(?: {4}[^\n]+;\n)* {2}\}\n)*)\}/;
const FRAME = / {2}([^\n{}]+) \{\n((?: {4}[^\n]+;\n)*) {2}\}\n/g;
const DECLARATION = / {4}([\w-]+): ([^\n]+);\n/g;

/**
 * A space's custom CSS read apart: the keyframes block {@link withKeyframesCss} put at its top, back as declarations,
 * and the space's own CSS without it. Only what reads back as exactly what {@link keyframesCss} writes is taken: a
 * keyframes rule written by hand, or one edited into another shape, stays where it is as the space's own CSS.
 */
export const splitKeyframesCss = (customCss: string): { keyframes: SpaceKeyframes; customCss: string } => {
  const keyframes: SpaceKeyframes = {};
  let rest = customCss;
  for (let match = RULE.exec(rest); match; match = RULE.exec(rest)) {
    const [written, name, body] = match;
    const frames: KeyframesFrames = {};
    for (const [, selector, declarations] of body.matchAll(FRAME)) {
      frames[selector] = Object.fromEntries(
        Array.from(declarations.matchAll(DECLARATION), ([, property, value]) => [property, value])
      );
    }

    const separated = rest.length === written.length || rest.startsWith('\n\n', written.length);
    if (Object.hasOwn(keyframes, name) || ruleCss(name, frames) !== written || !separated) {
      break;
    }

    keyframes[name] = frames;
    rest = rest.slice(written.length).replace(/^\n\n/, '');
  }

  return { keyframes, customCss: rest };
};

const KEYFRAMES_AT_RULE = /@(?:-webkit-)?keyframes\s+(["']?)(-?[_a-zA-Z][\w-]*)\1\s*\{/g;

/** Every keyframes name a stylesheet declares, hand-written or not. */
export const keyframesNamesIn = (stylesheet: string): string[] =>
  Array.from(stylesheet.matchAll(KEYFRAMES_AT_RULE), match => match[2]);

/** The names an `animation-name` value plays: each of its comma-separated layers but `none` and what a `var()` hides. */
export const animationNamesIn = (value: string): string[] =>
  value
    .split(',')
    .map(name => name.trim().replace(/^(["'])(.*)\1$/, '$2'))
    .filter(name => name && name !== 'none' && !name.includes('(') && isKeyframesName(name));
