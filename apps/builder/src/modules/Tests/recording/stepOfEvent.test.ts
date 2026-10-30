import { afterEach, describe, expect, it } from 'vitest';

import { changeStep, clickStep } from './stepOfEvent';

// The canvas is an iframe: what is recorded happens in another document, whose nodes are of another realm.
const canvas = (html: string): Document => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const inner = frame.contentDocument;
  if (!inner) {
    throw new Error('jsdom gave the iframe no document');
  }

  inner.body.innerHTML = html;

  return inner;
};

const eventOn = (target: Element, type: string): Event => {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'target', { value: target });

  return event;
};

const pick = (inner: Document, selector: string): Element => {
  const found = inner.querySelector(selector);
  if (!found) {
    throw new Error(`no ${selector} in the canvas`);
  }

  return found;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the step a click in the canvas records', () => {
  it('is a press of the closest element of the space, by its id', () => {
    const inner = canvas('<div data-plitzi-el="cta"><span>Buy now</span></div>');

    expect(clickStep(eventOn(pick(inner, 'span'), 'click'), false)).toEqual({ kind: 'click', element: 'cta' });
  });

  it('names which copy of an element a list draws more than once', () => {
    const inner = canvas('<p data-plitzi-el="row">a</p><p data-plitzi-el="row">b</p><p data-plitzi-el="row">c</p>');

    expect(clickStep(eventOn(inner.querySelectorAll('p')[1], 'click'), false)).toEqual({
      kind: 'click',
      element: 'row:2'
    });
  });

  it('holds what the element shows while expecting — or that it shows, when it has no words', () => {
    const inner = canvas('<h1 data-plitzi-el="title">  Your   cart </h1><div data-plitzi-el="badge"></div>');

    expect(clickStep(eventOn(pick(inner, 'h1'), 'click'), true)).toEqual({
      kind: 'expectText',
      element: 'title',
      text: 'Your cart'
    });
    expect(clickStep(eventOn(pick(inner, '[data-plitzi-el="badge"]'), 'click'), true)).toEqual({
      kind: 'expectShown',
      element: 'badge'
    });
  });

  it('records nothing for a click on nothing of the space', () => {
    const inner = canvas('<div><span>outside</span></div>');

    expect(clickStep(eventOn(pick(inner, 'span'), 'click'), false)).toBeUndefined();
  });
});

describe('the step a field changed records', () => {
  it('is what was typed in it', () => {
    const inner = canvas('<input data-plitzi-el="email" type="email" />');
    const field = pick(inner, 'input');
    Reflect.set(field, 'value', 'ana@example.com');

    expect(changeStep(eventOn(field, 'change'))).toEqual({ kind: 'type', element: 'email', text: 'ana@example.com' });
  });

  it('is none for a box or a choice: the click that changed it is its step', () => {
    const inner = canvas('<input data-plitzi-el="terms" type="checkbox" />');

    expect(changeStep(eventOn(pick(inner, 'input'), 'change'))).toBeUndefined();
  });
});
