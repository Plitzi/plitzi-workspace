// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pageTexts } from './texts';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

// la-velada's comparison listed every heading twice — "Boxeadores" only here, "BOXEADORES" only there — where both read
// the same: the copy draws it in capitals, the original writes it so.
describe('pageTexts', () => {
  it('reads each text as it is drawn — in the capitals a style draws it in', () => {
    document.body.innerHTML = [
      '<h2 style="text-transform: uppercase">Boxeadores</h2>',
      '<p style="text-transform: capitalize">la velada del año</p>',
      '<p>Tal cual</p>'
    ].join('');
    // jsdom lays nothing out: every element is given a box, so each counts as drawn.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ width: 100, height: 20 }));

    expect(pageTexts(10).map(each => each.text)).toEqual(['BOXEADORES', 'La Velada Del Año', 'Tal cual']);
  });
});
