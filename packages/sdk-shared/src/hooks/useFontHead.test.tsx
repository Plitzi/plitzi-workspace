/* eslint-disable quotes */
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import useFontHead from './useFontHead';

import type { FontHead } from '../types/StyleTypes';

const head = (overrides: Partial<FontHead> = {}): FontHead => ({
  preconnect: [],
  links: [],
  faces: '',
  origins: [],
  ...overrides
});

const inHead = (selector: string) => document.head.querySelectorAll(selector);

const Probe = ({ head: value }: { head: FontHead }) => {
  useFontHead(value);

  return null;
};

describe('useFontHead', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('puts the stylesheet and the faces in the document, not where the markup is', () => {
    render(
      <Probe
        head={head({
          preconnect: [{ href: 'https://fonts.gstatic.com', crossorigin: true }],
          links: [{ href: 'https://fonts.googleapis.com/css2?family=Lato:wght@400', rel: 'stylesheet' }],
          faces: '@font-face{font-family:"Acme";src:url(/fonts/a.woff2) format("woff2");}'
        })}
      />
    );

    expect(inHead('link[rel="preconnect"][crossorigin]')).toHaveLength(1);
    expect(inHead('link[rel="stylesheet"]')).toHaveLength(1);
    expect(document.head.querySelector('style[data-plitzi-fonts]')?.textContent).toContain('@font-face');
  });

  it("leaves the server's work alone: a hydrated page already carries every face it needs", () => {
    document.head.innerHTML =
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400" />' +
      '<style data-plitzi-fonts>@font-face{font-family:"Acme";}</style>';

    render(
      <Probe
        head={head({
          links: [{ href: 'https://fonts.googleapis.com/css2?family=Lato:wght@400', rel: 'stylesheet' }],
          faces: '@font-face{font-family:"Acme";}'
        })}
      />
    );

    expect(inHead('link[rel="stylesheet"]')).toHaveLength(1);
    expect(inHead('style[data-plitzi-fonts]')).toHaveLength(1);
  });

  it('takes back what it added, so a space swapped in place does not accumulate faces', () => {
    const { unmount } = render(
      <Probe head={head({ links: [{ href: '/fonts/sheet.css', rel: 'stylesheet' }], faces: '@font-face{}' })} />
    );
    expect(inHead('link,style')).toHaveLength(2);

    unmount();
    expect(inHead('link,style')).toHaveLength(0);
  });

  it('adds nothing at all for a space whose families are all system stacks', () => {
    render(<Probe head={head()} />);
    expect(document.head.innerHTML).toBe('');
  });
});
