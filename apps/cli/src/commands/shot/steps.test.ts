import { describe, expect, it } from 'vitest';

import { endsActing } from './steps';
import { parseSteps } from '../shotSteps';

const steps = (script: string) => {
  const parsed = parseSteps(script, 500);
  if ('problem' in parsed) {
    throw new Error(parsed.problem);
  }

  return parsed;
};

// lx-product: `page shot --steps "click <pill>"` pictured the menu shut — the picture before the click was the only one.
describe('page shot --steps', () => {
  it('pictures what steps leave when they end on an action, and adds none after a picture', () => {
    expect(endsActing(steps('click site-menu'))).toBe(true);
    expect(endsActing(steps('click site-menu; press Escape'))).toBe(true);
    expect(endsActing(steps('click site-menu; shot open'))).toBe(false);
    expect(endsActing(steps('click site-menu; frames 3'))).toBe(false);
  });
});
