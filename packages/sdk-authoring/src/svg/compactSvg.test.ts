import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { compactSvg } from './compactSvg';
import { svgFile, svgFiles } from '../node';

const EXPORTED = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: a design tool -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net" viewBox="0 0 24 24" data-name="Layer 1">
  <metadata><rdf:RDF/></metadata>
  <sodipodi:namedview pagecolor="#ffffff"/>
  <title>Stripe</title>
  <path d="M0 0h24v24H0z" inkscape:label="bg" fill="currentColor"/>
</svg>
`;

describe('compactSvg', () => {
  it('keeps what draws and its title, and drops what a design tool wrote for itself', () => {
    expect(compactSvg(EXPORTED)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>Stripe</title><path d="M0 0h24v24H0z" fill="currentColor"/></svg>'
    );
  });
});

describe('svgFile and svgFiles', () => {
  let folder = '';

  afterEach(() => rmSync(folder, { recursive: true, force: true }));

  it('read a folder of logos, by name, compacted — and refuse a file that is not an SVG, naming it', () => {
    folder = mkdtempSync(path.join(tmpdir(), 'svg-files-'));
    writeFileSync(path.join(folder, 'stripe.svg'), EXPORTED);
    writeFileSync(path.join(folder, 'notes.txt'), 'not a logo');

    expect(svgFiles(folder)).toEqual({ stripe: compactSvg(EXPORTED) });

    writeFileSync(path.join(folder, 'broken.svg'), '<div>no</div>');
    expect(() => svgFile(path.join(folder, 'broken.svg'))).toThrow(/broken\.svg is not an SVG/);
  });
});
