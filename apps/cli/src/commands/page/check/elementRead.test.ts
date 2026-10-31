import { describe, expect, it } from 'vitest';

import { elementReadText } from './text';

// A run's `page check --element map` printed the dev tools' read whole: every hazard the map was given, 1.6M characters.
describe('an element read by page check', () => {
  it('is said by shape, what it was given by size', () => {
    const hazards = Array.from({ length: 4000 }, (_, index) => ({ id: `h-${String(index)}`, name: 'ARNAB' }));
    const lines = elementReadText('map', {
      type: 'seismicMap',
      copies: 1,
      visible: true,
      attributes: { zoom: 2, hazards },
      state: { camera: { lat: 10, lng: 20 } },
      resolved: { 'attributes.hazards': hazards }
    });

    expect(lines).toEqual([
      '  · element map: seismicMap, seen (whole: --json)',
      '  · element map attributes: { zoom: 2, hazards: [4000] }',
      '  · element map own state: {"camera":{"lat":10,"lng":20}}',
      '  · element map given: { attributes.hazards: [4000] }'
    ]);
  });

  it("says a list row's given are the last row's drawn", () => {
    expect(
      elementReadText('contact-meta', { copies: 17, visible: true, resolved: { 'content.title': '135 kt' } })
    ).toContain('  · element contact-meta given (the last drawn of its 17 copies): { content.title: "135 kt" }');
  });
});
