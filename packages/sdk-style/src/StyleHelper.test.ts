import { describe, it, expect } from 'vitest';

import { processCssString } from './StyleHelper';

describe('StyleHelper.processCssString', () => {
  it('generates a secondary variable only if concatenation breaks CSS', () => {
    const result = processCssString('background-image', 'var(--webUrl)/assets/img/bg.png');
    expect(result).toEqual([
      '--webUrl-parsed:var(--webUrl)/assets/img/bg.png;',
      'background-image:var(--webUrl-parsed);'
    ]);
  });

  it('leaves valid var values intact', () => {
    const result = processCssString('color', 'var(--mainColor)');
    expect(result).toEqual(['color:var(--mainColor);']);
  });

  it('leaves valid non-var values intact', () => {
    const result = processCssString('padding', '10px 20px');
    expect(result).toEqual(['padding:10px 20px;']);
  });

  it('handles paths with special characters', () => {
    const result = processCssString('background-image', 'var(--webUrl)/assets/img/bg(1).png');
    expect(result).toEqual([
      '--webUrl-parsed:var(--webUrl)/assets/img/bg(1).png;',
      'background-image:var(--webUrl-parsed);'
    ]);
  });

  it('generates secondary variable for border shorthand with concatenation', () => {
    const result = processCssString('border', 'var(--borderWidth) solid black');
    expect(result).toEqual(['border:var(--borderWidth) solid black;']);
  });

  it('generates secondary variable for background shorthand with gradient', () => {
    const result = processCssString('background', 'var(--bgColor) linear-gradient(to right, red, blue)');
    expect(result).toEqual(['background:var(--bgColor) linear-gradient(to right, red, blue);']);
  });

  it('leaves valid box-shadow values intact', () => {
    const result = processCssString('box-shadow', '0 2px 4px var(--shadowColor)');
    expect(result).toEqual(['box-shadow:0 2px 4px var(--shadowColor);']);
  });

  it('handles margin with var concatenated', () => {
    const result = processCssString('margin', 'var(--spacing)10px');
    expect(result).toEqual(['--spacing-parsed:var(--spacing)10px;', 'margin:var(--spacing-parsed);']);
  });

  it('handles padding with simple var', () => {
    const result = processCssString('padding', 'var(--paddingValue)');
    expect(result).toEqual(['padding:var(--paddingValue);']);
  });

  it('handles border-radius with var concatenated', () => {
    const result = processCssString('border-radius', 'var(--radius)5px');
    expect(result).toEqual(['--radius-parsed:var(--radius)5px;', 'border-radius:var(--radius-parsed);']);
  });

  it('handles font-family with var concatenated', () => {
    const result = processCssString('font-family', 'var(--font) "Arial", sans-serif');
    expect(result).toEqual(['font-family:var(--font) "Arial", sans-serif;']);
  });

  it('handles text-shadow with var concatenated', () => {
    const result = processCssString('text-shadow', '0 1px 2px var(--shadowColor)');
    expect(result).toEqual(['text-shadow:0 1px 2px var(--shadowColor);']);
  });

  it('handles background with multiple concatenations', () => {
    const result = processCssString('background', 'var(--bgUrl)/img1.png var(--bgColor) repeat');
    expect(result).toEqual([
      '--bgUrl-parsed:var(--bgUrl)/img1.png var(--bgColor) repeat;',
      'background:var(--bgUrl-parsed);'
    ]);
  });
});
