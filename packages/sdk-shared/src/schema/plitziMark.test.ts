import { PLITZI_MARK_DATA_URL, PLITZI_MARK_SVG } from './plitziMark';

describe('schema/plitziMark', () => {
  it('is one SVG document, square, with the layers’ licence kept in it', () => {
    expect(PLITZI_MARK_SVG).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512"/);
    expect(PLITZI_MARK_SVG.endsWith('</svg>')).toBe(true);
    expect(PLITZI_MARK_SVG).toContain('CC BY 4.0');
  });

  it('draws from its address without asking any site', () => {
    expect(decodeURIComponent(PLITZI_MARK_DATA_URL.replace('data:image/svg+xml,', ''))).toBe(PLITZI_MARK_SVG);
    expect(PLITZI_MARK_DATA_URL).not.toContain('https://cdn.');
  });
});
