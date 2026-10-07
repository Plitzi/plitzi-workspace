import { InvalidArgumentError } from 'commander';
import { describe, expect, it } from 'vitest';

import { count, fill, positiveInteger, width, widths } from './options';

describe('options', () => {
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
});
