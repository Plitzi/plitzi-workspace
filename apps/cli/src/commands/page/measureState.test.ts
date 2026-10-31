import { describe, expect, it } from 'vitest';

import { pairOf } from './measure';
import { putIn, stateText } from './measureState';

describe('the state a page is measured in', () => {
  // The medal's fill fades in on its card's hover — measured by hand, with a script of design-1's own.
  it('puts a page in the state asked before measuring — hovered or focused, its transitions waited for — or says why not', async () => {
    const acts: string[] = [];
    const stand = (count: number, act: () => Promise<void>, shown = count) => {
      const element = {
        count: () => Promise.resolve(count),
        hover: () => act().then(() => acts.push('hover')),
        focus: () => act().then(() => acts.push('focus')),
        click: () => act().then(() => acts.push('click')),
        evaluate: () => Promise.resolve('display: none on log-fold, around it')
      };

      // A stand-in of a page: what putIn reads of one — its address, the element found, the state put, the wait.
      return {
        url: () => 'http://127.0.0.1:8080/combates',
        locator: () => ({
          first: () => element,
          filter: () => ({ first: () => element, count: () => Promise.resolve(shown) })
        }),
        evaluate: () => Promise.resolve(acts.push('settled')),
        keyboard: { press: (key: string) => Promise.resolve(acts.push(`press ${key}`)) },
        waitForTimeout: () => Promise.resolve(),
        // What a click asks the server is followed by its requests: none here.
        on: () => undefined,
        off: () => undefined
      } as unknown as Parameters<typeof putIn>[0];
    };
    const state = { kind: 'hover' as const, pairs: [pairOf('fight-card => .fight-card')] };

    expect(
      await putIn(
        stand(1, () => Promise.resolve()),
        state,
        'here'
      )
    ).toBeUndefined();
    expect(acts).toEqual(['hover', 'settled']);
    expect(
      await putIn(
        stand(0, () => Promise.resolve()),
        state,
        'here'
      )
    ).toEqual({
      problem: 'No element fight-card to hover on http://127.0.0.1:8080/combates'
    });
    expect(
      await putIn(
        stand(1, () => Promise.reject(new Error('Timeout 5000ms exceeded.\n  waiting for…'))),
        { ...state, kind: 'focus' },
        'there'
      )
    ).toEqual({
      problem: '.fight-card could not be focused on http://127.0.0.1:8080/combates: Timeout 5000ms exceeded.'
    });

    // On the page and drawn nowhere — a fold closed at 390: said so, where a run read "the page did not answer the press".
    expect(
      await putIn(
        stand(1, () => Promise.resolve(), 0),
        state,
        'here'
      )
    ).toEqual({
      problem:
        'fight-card is on http://127.0.0.1:8080/combates and not shown here (display: none on log-fold, around it): nothing to be hovered — open what holds it first (--click its toggle) or measure at a width it shows at'
    });

    // An open state — a drawer, then a panel in it — clicked in turn on each page, each settled.
    acts.length = 0;
    const opened = { kind: 'click' as const, pairs: [pairOf('toggle => .open'), pairOf('row => summary')] };
    expect(
      await putIn(
        stand(1, () => Promise.resolve()),
        opened,
        'there'
      )
    ).toBeUndefined();
    expect(acts).toEqual(['click', 'settled', 'click', 'settled']);
    expect(stateText(opened, 'there')).toBe('.open, then summary clicked');

    // A focus ring is drawn on `:focus-visible` — a keyboard's focus: a key pressed, then the element focused.
    acts.length = 0;
    expect(
      await putIn(
        stand(1, () => Promise.resolve()),
        { ...state, kind: 'focus' },
        'here'
      )
    ).toBeUndefined();
    expect(acts).toEqual(['press Shift', 'focus', 'settled']);

    // A menu opened, then an item of it hovered — the clicks first, the hover last, each settled.
    acts.length = 0;
    const menuItem = {
      kind: 'click' as const,
      pairs: [pairOf('site-avatar')],
      then: { kind: 'hover' as const, pair: pairOf('site-menu-item') }
    };
    expect(
      await putIn(
        stand(1, () => Promise.resolve()),
        menuItem,
        'here'
      )
    ).toBeUndefined();
    expect(acts).toEqual(['click', 'settled', 'hover', 'settled']);
    expect(stateText(menuItem, 'here')).toBe('site-avatar clicked, then site-menu-item hovered');
    // A review of a latched key could not measure whether pressing it pops it up: held down, as :active draws it.
    expect(stateText({ kind: 'press', pairs: [{ here: 'site-nav-charts', there: 'site-nav-charts' }] }, 'here')).toBe(
      'site-nav-charts held down'
    );
  });
});
