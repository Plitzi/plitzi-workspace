import {
  isFrameSelector,
  isKeyframesName,
  SDK_KEYFRAMES_PREFIX,
  withKeyframesCss as withKeyframesRule
} from '@plitzi/sdk-shared/style/keyframes';

import { AuthoringError } from './codes';
import { css } from '../style/css';

import type { CssProps } from '../style/types';
import type { KeyframesFrames, SpaceKeyframes } from '@plitzi/sdk-shared/style/keyframes';

export { splitKeyframesCss } from '@plitzi/sdk-shared/style/keyframes';
export type { SpaceKeyframes } from '@plitzi/sdk-shared/style/keyframes';

/**
 * A space's keyframes as an author writes them: by name, each frame keyed by its offset — `from`, `to`, `'50%'`,
 * `'0%, 100%'` — and its rules as any other CSS is written, shorthands allowed:
 *
 * ```ts
 * keyframes: { 'caret-blink': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } } }
 * ```
 *
 * A class plays them with `animation-name` (`animation: 'caret-blink 1s steps(1) infinite'`).
 */
export type KeyframesSpec = Record<string, Record<string, CssProps>>;

const frameOf = (name: string, selector: string, rules: CssProps): [string, KeyframesFrames[string]] => {
  if (!isFrameSelector(selector)) {
    throw new AuthoringError(
      'keyframes-shape',
      `"${selector}" in the keyframes "${name}" is not an offset: \`from\`, \`to\` or a percentage up to 100% — several of them joined by commas (\`'0%, 100%'\`).`
    );
  }

  return [selector, css(rules)];
};

/** The keyframes as the document keeps them: every name and frame checked, every frame's rules through {@link css}. */
export const authorKeyframes = (spec: KeyframesSpec | undefined): SpaceKeyframes | undefined => {
  if (!spec) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(spec).map(([name, frames]) => {
      if (!isKeyframesName(name)) {
        throw new AuthoringError(
          'keyframes-shape',
          `"${name}" is not a keyframes name CSS reads: letters, digits, \`-\` and \`_\`, not starting with a digit, and not \`none\`, \`initial\`, \`inherit\`, \`unset\`, \`revert\` or \`default\`.`
        );
      }

      if (name.startsWith(SDK_KEYFRAMES_PREFIX)) {
        throw new AuthoringError(
          'keyframes-shape',
          `"${name}" starts with \`${SDK_KEYFRAMES_PREFIX}\`, which the SDK's own keyframes are named with: name it something else.`
        );
      }

      const written = Object.entries(frames);
      if (written.length === 0) {
        throw new AuthoringError(
          'keyframes-shape',
          `The keyframes "${name}" have no frames: write at least \`from\` and \`to\` (or the offsets between).`
        );
      }

      return [name, Object.fromEntries(written.map(([selector, rules]) => frameOf(name, selector, rules)))];
    })
  );
};

/** The space's custom CSS with its keyframes at its top — where the style editor reads them back — checked first. */
export const withKeyframesCss = (customCss: string, spec: KeyframesSpec | undefined): string =>
  withKeyframesRule(customCss, authorKeyframes(spec));
