/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
import { describe, expect, it } from 'vitest';

import { inspectTemplate, processTwig, processTwigValue } from '../index';

/**
 * Twig that used to render a PLAUSIBLE WRONG VALUE rather than fail: `s starts with 'He'` evaluated to `s`, `2 ** 3` to
 * `0`, `['a', 'b'][1]` to the whole array. A value in a condition reads as true, so each of these was a branch that
 * always ran. Every row is what Twig itself answers.
 */
describe('processTwig — operators Twig has', () => {
  const context = { s: 'Hello', n: 5, empty: '', zero: 0, rows: [{ a: 1 }, { a: 2 }] };

  it.each([
    ["{{ s starts with 'He' ? 'y' : 'n' }}", 'y'],
    ["{{ s starts with 'lo' ? 'y' : 'n' }}", 'n'],
    ["{{ s ends with 'lo' ? 'y' : 'n' }}", 'y'],
    ["{{ n starts with '5' ? 'y' : 'n' }}", 'n'],
    ['{{ 17 // 5 }}', '3'],
    ['{{ -7 // 2 }}', '-4'],
    ['{{ 2 ** 3 }}', '8'],
    ['{{ 2 ** 3 ** 2 }}', '512'],
    ['{{ 2 * 3 ** 2 }}', '18'],
    ["{{ empty ?: 'fallback' }}", 'fallback'],
    ["{{ s ?: 'fallback' }}", 'Hello'],
    ["{{ zero ?: 'none' }}", 'none'],
    ["{{ n > 3 ? 'big' }}", 'big'],
    ["{{ n > 9 ? 'big' }}", ''],
    ["{{ ['a', 'b', 'c'][1] }}", 'b'],
    ["{{ ['a', 'b', 'c'][n - 4] }}", 'b'],
    ['{{ { x: 1, y: 2 }.y }}', '2'],
    ['{{ rows[1].a }}', '2']
  ])('%s → %s', (template, expected) => {
    expect(processTwig(template, context)).toBe(expected);
  });
});

describe('format — sprintf flags, width and precision', () => {
  it.each([
    ["{{ '%02d'|format(5) }}", '05'],
    ["{{ '%03d'|format(-5) }}", '-05'],
    ["{{ '%+04d'|format(3) }}", '+003'],
    ["{{ '%5s|'|format('ab') }}", '   ab|'],
    ["{{ '%-5s|'|format('ab') }}", 'ab   |'],
    ["{{ \"%'*6s\"|format('ab') }}", '****ab'],
    ["{{ '%.2f'|format(3.14159) }}", '3.14'],
    ["{{ '%06.2f'|format(3.14159) }}", '003.14'],
    ["{{ '%.3s'|format('abcdef') }}", 'abc'],
    ["{{ '%f'|format(3.5) }}", '3.5'],
    ["{{ '%d items, %s left'|format(3, 'two') }}", '3 items, two left']
  ])('%s → %s', (template, expected) => {
    expect(processTwig(template, {})).toBe(expected);
  });
});

describe('date — the tokens PHP uses most', () => {
  const at = '2026-10-04T18:05:00Z';

  it.each([
    ['D j M', 'Sun 4 Oct'],
    ['l, F j, Y', 'Sunday, October 4, 2026'],
    ['d/m/y', '04/10/26'],
    ['g:i A', '6:05 PM'],
    ['h:i a', '06:05 pm'],
    ['\\D\\a\\y: j', 'Day: 4']
  ])('%s', (format, expected) => {
    expect(processTwig(`{{ at|date('${format.replace(/\\/g, '\\\\')}', 'UTC') }}`, { at })).toBe(expected);
  });
});

describe('processTwigValue', () => {
  const context = { rows: [{ keep: true }, { keep: false }], count: 0, flag: false, id: '42', nothing: null };

  it('answers a single expression with its value, untouched', () => {
    expect(processTwigValue('{{ rows|filter(r => r.keep) }}', context)).toEqual([{ keep: true }]);
    expect(processTwigValue('{{ count }}', context)).toBe(0);
    expect(processTwigValue('{{ flag }}', context)).toBe(false);
    expect(processTwigValue('{{ nothing }}', context)).toBeNull();
    expect(processTwigValue('  {{ count > -1 }}\n', context)).toBe(true);
  });

  it('keeps a string a string, however much it looks like a number', () => {
    expect(processTwigValue('{{ id }}', context)).toBe('42');
  });

  it('renders anything with text or tags around it as text', () => {
    expect(processTwigValue('#{{ id }}', context)).toBe('#42');
    expect(processTwigValue('{% if flag %}on{% else %}off{% endif %}', context)).toBe('off');
    expect(processTwigValue('plain', context)).toBe('plain');
  });
});

describe('inspectTemplate', () => {
  it('reports nothing for a template the interpreter reads in full', () => {
    expect(inspectTemplate("{% set n = rows|length %}{{ n > 0 ? '%02d'|format(n) : 'none' }}").issues).toEqual([]);
    expect(inspectTemplate('{{ source|map(x => x.a)|sum }}').issues).toEqual([]);
  });

  it.each([
    ["{{ s matches '/^H/' }}", '`matches` is not supported'],
    ['{{ source|defualt }}', 'Unknown filter "defualt"'],
    ['{{ now() }}', 'Unknown function "now()"'],
    ['{{ a @ b }}', 'Unexpected "@ b"'],
    ['{{ (a + b }}', 'Missing a closing ")"'],
    ['{{ items[0 }}', 'Missing a closing "]"'],
    ['{% macro x %}{% endmacro %}', 'Unknown tag {% macro %}'],
    ['{{ a', 'Unclosed double-brace token']
  ])('%s', (template, issue) => {
    expect(inspectTemplate(template).issues.join('\n')).toContain(issue);
  });

  it('names what the template reads from outside, and not what it binds itself', () => {
    const { freeNames } = inspectTemplate(
      '{% set min = state.min %}{% for row in list_rows.items %}{{ row.a > min ? loop.index : source }}{% endfor %}' +
        '{{ apiContainer_tn-data.records|filter(r => r.id == navigation.routeParams.id)|length }}'
    );

    expect(freeNames.sort()).toEqual(['apiContainer_tn-data', 'list_rows', 'navigation', 'source', 'state']);
  });

  it('does not take the name of a test for something the template reads', () => {
    expect(inspectTemplate('{{ x is defined and y is not empty }}').freeNames.sort()).toEqual(['x', 'y']);
  });
});
