import { describe, expect, it } from 'vitest';

import { endsActing, interactionSteps } from './steps';
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

describe('the steps a --fill, --click and --hover are played as', () => {
  // encore-2: design-1 asked `page shot --click site-avatar --hover <item>` and was refused an option shot did not have.
  it('clicks, then hovers and pictures the page so — and pictures each click when nothing is hovered after', () => {
    expect(interactionSteps(undefined, ['site-avatar'], 'site-menu-item')).toBe(
      'click "site-avatar"; wait 600; hover "site-menu-item"; wait 400; shot site-menu-item hovered'
    );
    expect(interactionSteps(['type "name" Ana'], ['send'], undefined)).toBe(
      'shot before; type "name" Ana; click "send"; wait 600; shot after send'
    );
    expect(interactionSteps(undefined, ['send'], undefined)).toBeUndefined();
  });
});
