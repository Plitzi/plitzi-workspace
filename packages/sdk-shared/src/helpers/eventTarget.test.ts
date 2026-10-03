import { describe, expect, it } from 'vitest';

import { elementOf, isElementTarget, isNodeTarget, nodeOf } from './eventTarget';

describe('eventTarget', () => {
  it('reads a target of another window as the node it is', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const inner = frame.contentDocument?.createElement('div') ?? null;

    expect(inner instanceof Node).toBe(false);
    expect(isElementTarget(inner)).toBe(true);
    frame.remove();
  });

  it('tells a text node, a window and nothing apart from an element', () => {
    const text = document.createTextNode('a');

    expect(isNodeTarget(text)).toBe(true);
    expect(isElementTarget(text)).toBe(false);
    expect(isNodeTarget(window)).toBe(false);
    expect(isNodeTarget(null)).toBe(false);
    expect(nodeOf(text)).toBe(text);
    expect(nodeOf(window)).toBeNull();
  });

  it('hands an element on as itself and anything else as null', () => {
    const element = document.createElement('b');

    expect(elementOf(element)).toBe(element);
    expect(elementOf(document.createTextNode('a'))).toBeNull();
    expect(elementOf(window)).toBeNull();
  });
});
