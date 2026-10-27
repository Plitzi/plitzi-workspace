// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { drawnOtherwise, heldBackIssues, serverHtml } from './inspect';

// "Hydration failed" for the hero's time, found by reading the diff — React names no element in a build.
describe('a hydration error, named', () => {
  it('names the innermost elements the server drew otherwise, with both texts', () => {
    const served =
      '<main data-plitzi-el="home-hero"><time data-plitzi-el="home-hero-time">18:00h GMT+1</time><p data-plitzi-el="home-hero-venue">Sevilla</p></main>';
    document.body.innerHTML = served.replace('18:00h GMT+1', '11:00h GMT-6');

    expect(drawnOtherwise(served)).toEqual([
      'home-hero-time ("18:00h GMT+1" from the server → "11:00h GMT-6" in the browser)'
    ]);
    document.body.innerHTML = served;
    expect(drawnOtherwise(served)).toEqual([]);
  });
});

// A run's scout read six providers "not in the HTML the server sent" as mika: the HTML was asked as a guest.
describe('the HTML the server sent', () => {
  it('is asked as the page is, with its cookies — never as a guest', async () => {
    const guest = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('<main data-plitzi-el="sign-in"></main>'));
    const page = {
      request: {
        get: (url: string) =>
          Promise.resolve({
            ok: () => true,
            status: () => 200,
            text: () => Promise.resolve(`<main data-plitzi-el="profile-reminders" data-url="${url}"></main>`)
          }),
        post: () => Promise.reject(new Error('not asked'))
      }
    };

    expect(await serverHtml(page, 'http://localhost:4000/u/mika')).toContain('profile-reminders');
    expect(guest).not.toHaveBeenCalled();
    guest.mockRestore();
  });
});

// encore-12: a submit the browser held back passed the check, and no line could hold that it did not.
describe('a form the browser held back', () => {
  it('is a finding of the page, on the field it stopped at, naming noValidate', () => {
    expect(heldBackIssues(['sign-in-username — Please fill out this field.'], 390)).toEqual([
      {
        code: 'form-held-back',
        message: expect.stringContaining('noValidate: true on the form') as unknown,
        elementId: 'sign-in-username',
        width: 390
      }
    ]);
    expect(heldBackIssues([], 390)).toEqual([]);
  });
});
