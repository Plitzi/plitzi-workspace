/* eslint-disable quotes -- the expectations are TypeScript: prettier keeps the quotes inside them, eslint wants them single */
import { describe, expect, it } from 'vitest';

import { darkScheme, importedFiles } from './write';

import type { ImportNode, ImportProbe } from './probe';
import type { Imported } from './write';

const node = (path: string, overrides: Partial<ImportNode> = {}): ImportNode => ({
  path,
  tag: 'div',
  width: 1200,
  height: 100,
  style: {},
  children: [],
  ...overrides
});

const probe = (width: number, outline: ImportNode[], overrides: Partial<ImportProbe> = {}): ImportProbe => ({
  url: 'https://example.com/',
  title: 'Example',
  width,
  customProperties: {},
  colors: {
    background: '#ffffff',
    foreground: '#111111',
    accents: ['#4f46e5'],
    samples: {
      '#ffffff': { path: '', property: 'background-color' },
      '#111111': { path: '0', property: 'color' },
      '#4f46e5': { path: '1/0', property: 'background-color' }
    }
  },
  fonts: { body: 'Inter', heading: 'Inter', google: [{ family: 'Inter', weights: [400, 700] }], loaded: ['Inter'] },
  radii: ['12px'],
  shadows: [],
  outline,
  lists: [],
  assets: [],
  read: [],
  ...overrides
});

/** The file on one line, so an expectation says what is written rather than how it is indented. */
const fileOf = ({ files }: Imported, path: string): string => {
  const file = files.find(candidate => candidate.path === path);
  if (!file) {
    throw new Error(`no ${path} among ${files.map(candidate => candidate.path).join(', ')}`);
  }

  return file.content.replace(/\s+/g, ' ');
};

describe('importedFiles', () => {
  const desktopGrid = node('1/0', {
    tag: 'section',
    heading: 'Our features',
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      columnGap: '24px',
      backgroundColor: '#4f46e5',
      borderRadius: '12px'
    },
    children: [node('1/0/0', { height: 240, repeats: 6 })]
  });
  const compactGrid = node('1/0', {
    tag: 'section',
    heading: 'Our features',
    style: {
      display: 'grid',
      gridTemplateColumns: 'none',
      columnGap: '24px',
      backgroundColor: '#4f46e5',
      borderRadius: '12px'
    },
    children: [node('1/0/0', { height: 320, repeats: 6 })]
  });

  it('pairs each colour with the one the same place shows in the dark, or nothing when the page has no dark', () => {
    const light = probe(1440, []);

    expect(darkScheme(light, probe(1440, [], { read: ['#000000', '#eeeeee', '#818cf8'] }))).toEqual({
      colours: { '#ffffff': '#000000', '#111111': '#eeeeee', '#4f46e5': '#818cf8' },
      customProperties: {}
    });
    expect(darkScheme(light, probe(1440, [], { read: ['#ffffff', '#111111', '#4f46e5'] }))).toBeUndefined();
    expect(
      darkScheme(
        probe(1440, [], { customProperties: { brand: '#ff5500' } }),
        probe(1440, [], { customProperties: { brand: '#ff8844' }, read: ['#ffffff', '#111111', '#4f46e5'] })
      )
    ).toBeDefined();
  });

  it('writes tokens with a value per theme, from the dark probe where there is one', () => {
    const light = probe(1440, []);
    const files = importedFiles({
      probes: [light],
      dark: darkScheme(light, probe(1440, [], { read: ['#000000', '#eeeeee', '#818cf8'] }))
    });
    const tokens = fileOf(files, 'tokens.ts');

    expect(tokens).toContain("background: { light: '#ffffff', dark: '#000000', default: '#ffffff' }");
    expect(tokens).toContain("'accent-1': { light: '#4f46e5', dark: '#818cf8'");
    expect(tokens).toContain("'radius-1': '12px'");
    expect(tokens).toContain("family: 'Inter'");
    expect(tokens).toContain('preload: true');
    expect(fileOf(files, 'IMPORT.md')).not.toContain('the page has none');
  });

  it('says so when the page has no dark scheme, and keeps light as dark', () => {
    const files = importedFiles({ probes: [probe(1440, [])] });

    expect(fileOf(files, 'tokens.ts')).toContain("light: '#ffffff', dark: '#ffffff'");
    expect(fileOf(files, 'IMPORT.md')).toContain('the page has none');
  });

  it('names its own custom properties, and leaves out a framework’s and what it cannot place', () => {
    const files = importedFiles({
      probes: [
        probe(1440, [], {
          customProperties: { brand: '#ff5500', 'space-lg': '32px', 'tw-ring-color': '#000000', easing: 'ease-in' }
        })
      ]
    });
    const tokens = fileOf(files, 'tokens.ts');

    expect(tokens).toContain("brand: { light: '#ff5500'");
    // The page's own names come first, and a measured colour that one of them already is is not named twice.
    expect(tokens.indexOf('brand:')).toBeLessThan(tokens.indexOf('background:'));
    expect(tokens).toContain("'space-lg': '32px'");
    expect(tokens).not.toContain('tw-ring');
    expect(fileOf(files, 'IMPORT.md')).toContain('1 more custom properties of `:root`: easing.');
  });

  it('writes the outline per breakpoint, the narrower ones as what changes, and colours as tokens', () => {
    const files = importedFiles({
      probes: [probe(1440, [desktopGrid]), probe(768, [compactGrid]), probe(390, [compactGrid])]
    });
    const outline = fileOf(files, 'outline.ts');

    expect(outline).toContain("import { t } from './tokens.ts';");
    expect(outline).toContain("id: 'our-features'");
    expect(outline).toContain("subType: 'section'");
    expect(outline).toContain("backgroundColor: t['accent-1']");
    expect(outline).toContain("borderRadius: t['radius-1']");
    // Tablet and mobile change the same way: written once.
    expect(outline).toContain("compact: { gridTemplateColumns: 'none' }");
    expect(outline).toContain('// One of 6 alike: a list.');
    expect(outline).toContain("minHeight: '240px'");
    expect(outline).toContain("minHeight: '320px'");
  });

  it('hides at a width what the page does not show there, and resets what a narrower width drops', () => {
    const aside = node('2', { tag: 'aside', style: { display: 'flex', paddingTop: '24px' } });
    const files = importedFiles({
      probes: [
        probe(1440, [aside, node('3', { tag: 'footer', style: { display: 'flex' } })]),
        probe(390, [node('3', { tag: 'footer' })])
      ]
    });
    const outline = fileOf(files, 'outline.ts');

    expect(outline).toContain("mobile: { display: 'none' }");
    expect(outline).toContain("mobile: { display: 'block' }");
    expect(outline).not.toContain('tablet');
  });

  it('gives every block a valid id that is not taken, and an outline without colours imports no tokens', () => {
    const files = importedFiles({
      probes: [
        probe(1440, [
          node('0', { tag: 'header', heading: '2024 · Ünïcode!' }),
          node('1', { heading: 'Features' }),
          node('2', { heading: 'Features' }),
          node('3', { id: 'contact' })
        ])
      ]
    });
    const outline = fileOf(files, 'outline.ts');

    expect(outline).toContain("id: 'header-2024-unicode'");
    expect(outline).toContain("id: 'features'");
    expect(outline).toContain("id: 'features-2'");
    expect(outline).toContain("id: 'contact'");
    expect(outline).not.toContain('./tokens.ts');
  });

  it('writes each repeated list as rows, named after where it was found', () => {
    const files = importedFiles({
      probes: [
        probe(1440, [desktopGrid], {
          lists: [
            {
              name: 'our-features',
              path: '1/0/0',
              items: [{ title: 'Fast' }, { title: 'Small' }, { title: 'Kind' }]
            }
          ]
        })
      ]
    });

    expect(JSON.parse(fileOf(files, 'data/our-features.json'))).toEqual({
      items: [{ title: 'Fast' }, { title: 'Small' }, { title: 'Kind' }]
    });
    expect(fileOf(files, 'outline.ts')).toContain(
      '// One of 6 alike: a list — its rows are in data/our-features.json.'
    );
    expect(fileOf(files, 'outline.ts')).toContain("id: 'our-features-item'");
  });

  it('counts what it found', () => {
    const { summary } = importedFiles({
      probes: [probe(1440, [desktopGrid], { lists: [{ name: 'features', path: '1/0/0', items: [{ title: 'A' }] }] })]
    });

    expect(summary).toEqual({
      url: 'https://example.com/',
      widths: [1440],
      colours: 3,
      dark: false,
      shadows: 0,
      radii: 1,
      fonts: ['Inter'],
      blocks: 2,
      lists: [{ file: 'data/features.json', rows: 1 }],
      pictures: 0
    });
  });

  it("names a colour once, by the page's own name, and rules use that name", () => {
    const grid = node('0', { style: { backgroundColor: '#4f46e5' }, children: [node('0/0')] });
    const files = importedFiles({ probes: [probe(1440, [grid], { customProperties: { primary: '#4F46E5' } })] });

    expect(fileOf(files, 'tokens.ts')).not.toContain("'accent-1':");
    expect(fileOf(files, 'outline.ts')).toContain('backgroundColor: t.primary');
  });

  it('writes no rules where a block has none of its own', () => {
    const files = importedFiles({ probes: [probe(1440, [node('0', { tag: 'main', children: [node('0/0')] })])] });

    expect(fileOf(files, 'outline.ts')).toContain("container({ id: 'main', subType: 'main', children: [");
  });

  it('refuses nothing measured', () => {
    expect(() => importedFiles({ probes: [] })).toThrow('no page was measured');
  });
});
