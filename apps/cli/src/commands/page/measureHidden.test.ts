// @vitest-environment jsdom
import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { hiddenWhyInPage } from './measureOn';
import { measuredText } from './measureText';
import { onlyOf } from './measureValues';

import type { Measured } from './measureValues';

// A run's dev-1 measured a hidden "Remind me" button: a 0,0 box, and no word of why it was drawn nowhere.
describe('an element measured that a visitor does not see', () => {
  it('says the nearest cause: its own, or the box around it that hides it', () => {
    document.body.innerHTML = `
      <div data-plitzi-el="room-show-actions" style="display: none"><button data-plitzi-el="remind">Remind me</button></div>
      <span data-plitzi-el="ghost" style="visibility: hidden">x</span>
      <p data-plitzi-el="gone" hidden>y</p>
      <i data-plitzi-el="empty"></i>`;
    const at = (id: string): Element => {
      const node = document.querySelector(`[data-plitzi-el="${id}"]`);
      if (!node) {
        throw new Error(`${id} is not in the fixture`);
      }

      return node;
    };

    expect(hiddenWhyInPage(at('remind'))).toBe('display: none on room-show-actions, around it');
    expect(hiddenWhyInPage(at('room-show-actions'))).toBe('display: none');
    expect(hiddenWhyInPage(at('ghost'))).toBe('visibility: hidden');
    expect(hiddenWhyInPage(at('gone'))).toBe('display: none');
    expect(hiddenWhyInPage(at('empty'))).toBe('no size: 0 × 0 px');
  });
});

describe('a reading of an element a visitor does not see', () => {
  // A designer proved a profile's own button by its widths and place — of a button hidden, with no box: never said.
  it('says an element measured is hidden, alone and beside the other page', () => {
    const shown: Measured = {
      selector: '#follow',
      tag: 'button',
      text: 'Follow',
      box: { x: 0, y: 0, width: 96, height: 0 },
      styles: { width: '96px' },
      inherited: []
    };
    const hidden: Measured = {
      ...shown,
      styles: { x: '0px', y: '0px', width: '0px', color: 'rgb(9, 9, 9)' },
      hidden: 'display: none on room-show-actions, around it'
    };

    // A run's dev-1 read a hidden button's 0,0 box as its place, and inferred its row from another.
    const alone = stripVTControlCharacters(measuredText(hidden));
    expect(alone).toContain(
      'hidden: a visitor sees none of what it finds — display: none on room-show-actions, around it; its place and size are not on the page, so not said'
    );
    expect(alone).toContain('color');
    expect(alone).not.toMatch(/^\s+(x|y|width)\s/m);
    expect(stripVTControlCharacters(measuredText(hidden, shown))).toContain('hidden here: a visitor sees none');
    // `--only after:margin-left` of a row drawing no ::after printed nothing at all.
    const narrowed = onlyOf(shown, ['width', 'after:margin-left']);
    if ('problem' in narrowed) {
      throw new Error(narrowed.problem);
    }

    expect(narrowed.undrawn).toEqual(['after']);
    expect(stripVTControlCharacters(measuredText(narrowed))).toContain('it draws no ::after, so nothing of it is read');
    expect(stripVTControlCharacters(measuredText(shown, shown))).not.toContain('hidden');
  });
});
