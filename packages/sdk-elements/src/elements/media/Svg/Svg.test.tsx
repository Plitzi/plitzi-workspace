import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { fitSvg, isSvgMarkup, sanitizeSvg } from './sanitizeSvg';
import { Svg } from './Svg';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({ settings: { previewMode: true }, contexts: {} })
}));

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12l5 5L20 7"/></svg>';

describe('Svg', () => {
  it('draws the markup, hidden from readers unless it is labelled', () => {
    const { container, rerender } = render(
      <ElementContext value={skipHocEntry()}>
        <Svg content={CHECK} />
      </ElementContext>
    );
    const host = container.querySelector('.plitzi-component__svg');

    expect(host?.querySelector('svg path')).not.toBeNull();
    expect(host?.getAttribute('aria-hidden')).toBe('true');

    rerender(
      <ElementContext value={skipHocEntry()}>
        <Svg content={CHECK} label="Done" />
      </ElementContext>
    );

    expect(container.querySelector('.plitzi-component__svg')?.getAttribute('role')).toBe('img');
    expect(container.querySelector('.plitzi-component__svg')?.getAttribute('aria-label')).toBe('Done');
  });

  it('draws nothing that is not one SVG', () => {
    expect(isSvgMarkup(CHECK)).toBe(true);
    expect(isSvgMarkup(`<!-- icon -->\n${CHECK}\n`)).toBe(true);
    expect(isSvgMarkup('<div><svg></svg></div>')).toBe(false);
    expect(isSvgMarkup('<img src=x onerror=alert(1)>')).toBe(false);
  });

  it('takes out everything that runs', () => {
    const hostile =
      '<svg onload="alert(1)"><script>alert(2)</script><foreignObject><iframe src="x"></iframe></foreignObject>' +
      '<a href="javascript:alert(3)"><set attributeName="href" to="javascript:alert(4)"/></a></svg>';
    const clean = sanitizeSvg(hostile);

    expect(clean).not.toMatch(/alert|script|foreignObject|onload/i);
    expect(clean).toMatch(/^<svg>/);
  });

  it('fills the box its class sizes, whatever size the markup claims', () => {
    expect(fitSvg('<svg viewBox="0 0 24 24" width="24" height=\'24\'><path d="M0 0"/></svg>')).toBe(
      '<svg width="100%" height="100%" viewBox="0 0 24 24"><path d="M0 0"/></svg>'
    );
    expect(fitSvg('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>')).toBe(
      '<svg width="100%" height="100%" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'
    );
  });
});
