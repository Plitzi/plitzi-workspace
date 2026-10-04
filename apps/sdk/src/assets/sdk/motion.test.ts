import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

import {
  MOTION_DEFAULT_DURATION,
  MOTION_ENTER_EASING,
  MOTION_ENTER_FROM,
  MOTION_ENTERS,
  MOTION_LOOP_FRAMES,
  MOTION_LOOPS
} from '@plitzi/sdk-shared/schema/motion';

const css = compileString('@use "motion"; @include motion.styles;', {
  loadPaths: [path.dirname(fileURLToPath(import.meta.url))]
}).css;

const keyframes = (name: string): string => {
  const found = new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(css);
  if (!found?.[1]) {
    throw new Error(`_motion.scss has no @keyframes ${name}`);
  }

  return found[1].replace(/\s+/g, ' ').trim();
};

// The builder's Motion tab previews each preset from sdk-shared's frames, not from this stylesheet: they must agree.
describe('_motion.scss', () => {
  it.each(MOTION_ENTERS)('starts the %s arrival where sdk-shared says', name => {
    const declarations = Object.entries(MOTION_ENTER_FROM[name])
      .map(([property, value]) => `${property}: ${String(value)};`)
      .join(' ');

    expect(keyframes(`plitzi-motion-${name}`)).toBe(`from { ${declarations} }`);
  });

  it.each(MOTION_LOOPS)('moves the %s loop through the frame, period and curve sdk-shared says', name => {
    const { transform, at, periodMs, easing } = MOTION_LOOP_FRAMES[name];
    const rule = new RegExp(
      `\\[data-motion-loop=${name}\\] \\{\\s*--plitzi-motion-loop: plitzi-motion-loop-${name};\\s*` +
        '--plitzi-motion-loop-period: ([\\d.]+)s;\\s*--plitzi-motion-loop-easing: ([\\w-]+);'
    ).exec(css);

    expect(keyframes(`plitzi-motion-loop-${name}`)).toBe(`${at === 'end' ? 'to' : '50%'} { transform: ${transform}; }`);
    expect(Number(rule?.[1]) * 1000).toBe(periodMs);
    expect(rule?.[2]).toBe(easing);
  });

  it('times an arrival with the default and the curve sdk-shared says', () => {
    expect(css).toContain(`var(--plitzi-motion-duration, ${String(MOTION_DEFAULT_DURATION)}ms)`);
    expect(css).toContain(MOTION_ENTER_EASING);
  });

  it('holds an arrival waiting to be seen until it is, and ties only `scroll` to the scroll', () => {
    const flat = css.replace(/\s+/g, ' ');

    expect(flat).toContain(
      '[data-motion-on=view]:not([data-motion-seen])[data-motion-enter], [data-motion-on=view]:not([data-motion-seen])[data-motion-stagger] > * { animation-play-state: paused, paused; }'
    );
    expect(flat).toMatch(/@media \(scripting: none\) \{ \[data-motion-on=view\]\[data-motion-enter\]/);
    expect(flat).toMatch(
      /\[data-motion-on=scroll\]\[data-motion-enter\], \[data-motion-on=scroll\]\[data-motion-stagger\] > \* \{ animation-timeline: view\(\), auto;/
    );
    expect(flat).not.toMatch(/\[data-motion-on=view\][^{]*\{ animation-timeline/);
  });
});
