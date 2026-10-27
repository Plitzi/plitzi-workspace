import { Command, InvalidArgumentError } from 'commander';
import { describe, expect, it } from 'vitest';

import {
  count,
  duration,
  durationText,
  expectation,
  fill,
  pagePath,
  pagePathList,
  pagePaths,
  positiveInteger,
  scale,
  schemes,
  swallowedFlag,
  timeZone,
  width,
  widths
} from './options';

describe('options', () => {
  // A run: `--width "390 dark"` heard only what a width is; `page measure '/explore --as dax'` opened
  // /explore%20--as%20dax.
  it('refuses a value or a path that holds several words, saying where each goes', () => {
    expect(() => widths('390 dark')).toThrow(
      '"390 dark" is 2 words in one value — quotes or a shell variable joined them: 390 alone, and dark is a scheme: --scheme dark.'
    );
    expect(() => pagePath('/explore --as dax')).toThrow(
      '"/explore --as dax" is 3 words in one path — quotes or a shell variable joined them: /explore alone, and --as dax is an option of the command, outside the quotes.'
    );
    expect(() => pagePath('dark')).toThrow('dark is no page: dark is a scheme: --scheme dark.');
    expect(() => pagePath('390')).toThrow('390 is no page: 390 is a width: --width 390.');
    expect(() => pagePath('about')).toThrow('"about" is no page\'s path: a path starts with / — /about.');
    expect(pagePath('/r/night-drive?tab=2')).toBe('/r/night-drive?tab=2');
    const command = new Command('shot').argument('[paths...]', 'pages', pagePathList).action(() => undefined);
    command.parse(['/', '/about'], { from: 'user' });
    expect(command.processedArgs).toEqual([['/', '/about']]);
  });

  // `run report --summary --token <it>` read "--token" as the summary's file and the token as the run.
  it('says a flag that took the next flag as its value', () => {
    const command = new Command('report').option('--summary <file>').option('--token <token>').argument('[run]');
    command.parse(['--summary', '--token', 'lx.@lead.abc'], { from: 'user' });
    expect(swallowedFlag(command)).toBe('--summary takes a value and read --token as it: --summary <file>');
    const fine = new Command('report').option('--summary <file>').option('--token <token>');
    fine.parse(['--summary', 'notes.md', '--token', 'lx.@lead.abc'], { from: 'user' });
    expect(swallowedFlag(fine)).toBeUndefined();
  });

  // `page shot / 390 dark site-header --width --scheme --clip` was told a width is a whole number, five times.
  it('says a value that is the next option is missing, not invalid', () => {
    for (const parse of [widths, schemes, positiveInteger, timeZone]) {
      expect(() => parse('--scheme')).toThrow('--scheme is the next option, not a value');
    }
  });

  // A 16 px mark read cell by cell needed a script of the designer's own — page shot had no zoom.
  it('reads a picture’s scale, 1 to 4', () => {
    expect(scale('3')).toBe(3);
    expect(() => scale('8')).toThrow('A scale is a whole number from 1 to 4');
  });

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

  // A run's design-2 wrote `design-palette~` for "it is there": an id alone says the element is shown.
  it('reads an id alone as an element that is shown, whatever it says — and refuses a ~ with nothing after it', () => {
    expect(expectation('design-palette', undefined)).toEqual([{ element: 'design-palette', text: '' }]);
    expect(expectation('/design design-palette', undefined)).toEqual([
      { element: 'design-palette', text: '', path: '/design' }
    ]);
    expect(() => expectation('design-palette~', undefined)).toThrow(InvalidArgumentError);
  });

  // A run's design-2 could not test a visitor elsewhere: the server and the browser both read the machine's zone.
  it('takes a time zone the browser knows, and refuses one it does not, by name', () => {
    expect(timeZone(' America/Mexico_City ')).toBe('America/Mexico_City');
    expect(() => timeZone('Mars/Olympus')).toThrow('"Mars/Olympus" is no time zone');
  });

  // `page shot --scheme light,dark` was refused, where `--width 1440,390` was taken.
  it('reads schemes as widths are read, each once, and refuses one that is none', () => {
    expect(schemes('light,dark,light')).toEqual(['light', 'dark']);
    expect(() => schemes('light,sepia')).toThrow('A scheme is light or dark');
  });
});
