import { describe, expect, it } from 'vitest';

import { lookChanges } from './moments';

// velada-backlog: the VS medal's fill faded in on its ::before by a custom property its card's hover set, and
// `task look --hover` said nothing changed — design-1 read it with a script of its own.
describe('what a hover changes', () => {
  it("says a pseudo-element's change and a custom property's, the latter once — where it changed, not where it is inherited", () => {
    const before = {
      card: { values: { 'background-color': 'rgb(1, 2, 3)' } },
      vs: { parent: 'card', values: { 'before:opacity': '0.6', '--fill': '0.6' } },
      'vs-text': { parent: 'vs', values: { '--fill': '0.6', color: 'rgb(0, 0, 0)' } }
    };
    const after = {
      card: { values: { 'background-color': 'rgb(1, 2, 3)' } },
      vs: { parent: 'card', values: { 'before:opacity': '1', '--fill': '1' } },
      'vs-text': { parent: 'vs', values: { '--fill': '1', color: 'rgb(0, 0, 0)' } }
    };

    expect(lookChanges(before, after)).toEqual(['vs before:opacity: 0.6 → 1', 'vs --fill: 0.6 → 1']);
  });
});
