import { InvalidArgumentError } from 'commander';
import { describe, expect, it } from 'vitest';

import { positiveInteger, width, widths } from './options';

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
});
