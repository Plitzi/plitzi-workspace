import { InvalidArgumentError } from 'commander';
import { describe, expect, it } from 'vitest';

import { count, duration, durationText, expectation, fill, pagePaths, positiveInteger, width, widths } from './options';

describe('options', () => {
  it('reads pages by path, each once, and refuses one that is not a path', () => {
    expect(pagePaths('/, /boxeadores,/')).toEqual(['/', '/boxeadores']);
    expect(() => pagePaths('boxeadores')).toThrow(InvalidArgumentError);
  });

  it('reads widths in the order given, each once', () => {
    expect(widths('1440, 390,1440')).toEqual([1440, 390]);
    expect(width('768')).toBe(768);
  });

  it('refuses a width that is not one, rather than falling back', () => {
    expect(() => widths('1440,abc')).toThrow(InvalidArgumentError);
    expect(() => width('100')).toThrow('from 320 to 3840');
    expect(() => width('1440.5')).toThrow(InvalidArgumentError);
    expect(() => widths('')).toThrow(InvalidArgumentError);
  });

  it('takes a whole number from 1', () => {
    expect(positiveInteger('4')).toBe(4);
    expect(() => positiveInteger('0')).toThrow(InvalidArgumentError);
    expect(() => positiveInteger('-2')).toThrow(InvalidArgumentError);
    expect(() => positiveInteger('two')).toThrow(InvalidArgumentError);
  });

  it('takes a whole number from 0 for a count', () => {
    expect(count('0')).toBe(0);
    expect(count('12')).toBe(12);
    expect(() => count('')).toThrow(InvalidArgumentError);
    expect(() => count('-1')).toThrow(InvalidArgumentError);
    expect(() => count('1.5')).toThrow(InvalidArgumentError);
  });

  it('reads a field to fill as its id and everything after the first =, one per flag, in order', () => {
    const first = fill('news-email=ana@example.com', undefined);

    expect(fill('query=a=b', first)).toEqual([
      { element: 'news-email', value: 'ana@example.com' },
      { element: 'query', value: 'a=b' }
    ]);
    expect(fill('note=', undefined)).toEqual([{ element: 'note', value: '' }]);
    expect(() => fill('news-email', undefined)).toThrow('<id>=<value>');
    expect(() => fill('=x', undefined)).toThrow(InvalidArgumentError);
  });

  it('reads a wait in seconds, minutes or hours — a bare number as minutes — and says it back', () => {
    expect(duration('90s')).toBe(90_000);
    expect(duration('8m')).toBe(480_000);
    expect(duration('1.5h')).toBe(5_400_000);
    expect(duration('25')).toBe(1_500_000);
    expect(durationText(duration('90s'))).toBe('1 min 30 s');
    expect(durationText(duration('45s'))).toBe('45 s');
    expect(durationText(duration('90m'))).toBe('1 h 30 min');
    expect(() => duration('0s')).toThrow('from 1s to 24h');
    expect(() => duration('2d')).toThrow(InvalidArgumentError);
    expect(() => duration('25h')).toThrow(InvalidArgumentError);
  });

  it('reads an expectation for every page, or for one named before it', () => {
    expect(expectation('walks-title~October', undefined)).toEqual([{ element: 'walks-title', text: 'October' }]);
    expect(expectation('/faq faq-title~Questions asked', undefined)).toEqual([
      { element: 'faq-title', text: 'Questions asked', path: '/faq' }
    ]);
    expect(() => expectation('/faq', undefined)).toThrow(InvalidArgumentError);
  });
});
