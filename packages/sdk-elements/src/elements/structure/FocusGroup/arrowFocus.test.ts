// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { arrowTarget } from './arrowFocus';

/** jsdom lays nothing out: every element has a box but those under `hidden`, as a browser would. */
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return (this.closest('[hidden]') ? [] : [{}]) as unknown as DOMRectList; // the length alone is read
  });
  document.body.innerHTML = `
    <div id="palette">
      <input id="q" type="text" />
      <ul id="recent"><li><button id="r1">Torque</button></li><li><button id="r2">Pulsar</button></li></ul>
      <ul id="pages"><li><a id="p1" href="/logs">Logs</a></li><li hidden><a id="p2" href="/x">Hidden</a></li><li><a id="p3" href="/roles">Roles</a></li></ul>
    </div>`;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const byId = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`no #${id}`);
  }

  return node;
};

const from = (id: string, key: Parameters<typeof arrowTarget>[2]) => arrowTarget(byId('palette'), byId(id), key)?.id;

// A search palette's results were reached with Tab alone, one at a time, across every group.
describe('the arrow keys inside a container', () => {
  it('go down from the field into the controls, and up from the first back to it — the rest stay the caret’s', () => {
    expect(from('q', 'ArrowDown')).toBe('r1');
    expect(from('q', 'ArrowUp')).toBeUndefined();
    expect(from('q', 'ArrowRight')).toBeUndefined();
    expect(from('r1', 'ArrowUp')).toBe('q');
  });

  it('go through the controls in reading order, past one that is hidden', () => {
    expect(from('r2', 'ArrowDown')).toBe('p1');
    expect(from('p1', 'ArrowDown')).toBe('p3');
    expect(from('p3', 'ArrowDown')).toBeUndefined();
    expect(from('p3', 'Home')).toBe('r1');
    expect(from('r1', 'End')).toBe('p3');
  });

  it('jump to the first control of the next or the previous list with ← and →', () => {
    expect(from('r2', 'ArrowRight')).toBe('p1');
    expect(from('p3', 'ArrowLeft')).toBe('r1');
    expect(from('p1', 'ArrowRight')).toBeUndefined();
    expect(from('r1', 'ArrowLeft')).toBeUndefined();
  });
});
