import { describe, expect, it } from 'vitest';

import { FontValidationError, parseSpaceFont } from './fontValidation';

const base = { family: 'Lato', fallback: 'sans-serif' };

const rejects = (value: unknown, message: string) => {
  expect(() => parseSpaceFont(value)).toThrow(FontValidationError);
  expect(() => parseSpaceFont(value)).toThrow(message);
};

describe('parseSpaceFont', () => {
  it('fills in what a caller may leave out', () => {
    expect(parseSpaceFont({ ...base, source: 'google' })).toEqual({
      source: 'google',
      family: 'Lato',
      fallback: 'sans-serif',
      weights: [400],
      styles: ['normal']
    });
  });

  it('sorts and de-duplicates the weights, so one family means one request', () => {
    expect(parseSpaceFont({ ...base, source: 'google', weights: [700, 400, 700] }).weights).toEqual([400, 700]);
  });

  it('keeps only the fields the source actually has', () => {
    const font = parseSpaceFont({ ...base, source: 'system', subsets: ['latin'], stylesheet: 'https://x.test/a.css' });
    expect(font).toEqual({
      source: 'system',
      family: 'Lato',
      fallback: 'sans-serif',
      weights: [400],
      styles: ['normal']
    });
  });

  it('refuses a family that could break out of the style element it is written into', () => {
    rejects({ ...base, family: 'a\u0000b', source: 'system' }, 'control characters');
    rejects({ ...base, family: '   ', source: 'system' }, 'cannot be empty');
    rejects({ ...base, family: 'x'.repeat(101), source: 'system' }, 'longer than 100');
  });

  it('insists on a fallback, since it is what the visitor reads first', () => {
    rejects({ family: 'Lato', source: 'google' }, 'font.fallback is required');
  });

  it('refuses a remote font that names nowhere to load from', () => {
    rejects({ ...base, source: 'remote' }, 'either a stylesheet URL or the font files');
  });

  it('refuses a remote URL that is not plain https', () => {
    rejects({ ...base, source: 'remote', stylesheet: 'http://x.test/a.css' }, 'must be an https URL');
    rejects({ ...base, source: 'remote', stylesheet: 'javascript:alert(1)' }, 'must be an https URL');
    rejects(
      {
        ...base,
        source: 'remote',
        files: [{ weight: 400, style: 'normal', format: 'woff2', url: 'data:font/woff2,' }]
      },
      'must be an https URL'
    );
  });

  it('takes a remote font served as files', () => {
    const font = parseSpaceFont({
      ...base,
      source: 'remote',
      files: [
        { weight: 400, style: 'normal', format: 'woff2', url: 'https://cdn.test/a.woff2', unicodeRange: 'U+0-FF' }
      ]
    });
    expect(font).toMatchObject({
      source: 'remote',
      files: [
        { weight: 400, style: 'normal', format: 'woff2', url: 'https://cdn.test/a.woff2', unicodeRange: 'U+0-FF' }
      ]
    });
  });

  it('refuses a hosted path that is a URL or climbs out of the store', () => {
    const hosted = (path: string) => ({
      ...base,
      source: 'hosted',
      files: [{ weight: 400, style: 'normal', format: 'woff2', path }]
    });
    rejects(hosted('https://cdn.test/a.woff2'), 'must be relative to the font store');
    rejects(hosted('/etc/passwd'), 'must be relative to the font store');
    rejects(hosted('../../secrets/a.woff2'), 'cannot climb out');
    expect(parseSpaceFont(hosted('space-1/lato-400.woff2'))).toMatchObject({ source: 'hosted' });
  });

  it('refuses a hosted font with no files at all', () => {
    rejects({ ...base, source: 'hosted', files: [] }, 'font.files must be a non-empty list');
  });

  it('refuses a face whose weight or format is not one', () => {
    const hosted = (file: unknown) => ({ ...base, source: 'hosted', files: [file] });
    rejects(
      hosted({ weight: '400', style: 'normal', format: 'woff2', path: 'a.woff2' }),
      'weight must be a whole number'
    );
    rejects(
      hosted({ weight: 400, style: 'oblique', format: 'woff2', path: 'a.woff2' }),
      'must be "normal" or "italic"'
    );
    rejects(hosted({ weight: 400, style: 'normal', format: 'ttf', path: 'a.woff2' }), 'must be "woff2" or "woff"');
  });

  it('refuses a source nobody serves', () => {
    rejects({ ...base, source: 'adobe' }, 'font.source must be one of');
    rejects('Lato', 'a font must be an object');
  });
});
