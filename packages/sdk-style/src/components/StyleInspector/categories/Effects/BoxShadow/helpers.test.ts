import { describe, it, expect } from 'vitest';

import { splitByCommaOutsideParens, splitBySpaceOutsideParens } from './helpers';

describe('splitByCommaOutsideParens', () => {
  describe('basic values', () => {
    it('splits simple comma-separated values', () => {
      expect(splitByCommaOutsideParens('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('handles single value', () => {
      expect(splitByCommaOutsideParens('1px 1px 3px black')).toEqual(['1px 1px 3px black']);
    });

    it('returns empty array for empty string', () => {
      expect(splitByCommaOutsideParens('')).toEqual([]);
    });

    it('handles values with spaces around commas', () => {
      expect(splitByCommaOutsideParens('a , b , c')).toEqual(['a ', ' b ', ' c']);
    });

    it('trims each result', () => {
      const result = splitByCommaOutsideParens('a,b,c');
      expect(result.map(s => s.trim())).toEqual(['a', 'b', 'c']);
    });
  });

  describe('parenthesized values', () => {
    it('does not split commas inside single parentheses', () => {
      expect(splitByCommaOutsideParens('rgba(0,0,0,1),rgba(255,255,255,0.5)')).toEqual([
        'rgba(0,0,0,1)',
        'rgba(255,255,255,0.5)'
      ]);
    });

    it('does not split commas inside nested parentheses', () => {
      expect(splitByCommaOutsideParens('var(--shadow, 0 1px 2px rgba(0,0,0,0.1))')).toEqual([
        'var(--shadow, 0 1px 2px rgba(0,0,0,0.1))'
      ]);
    });

    it('handles deeply nested parentheses', () => {
      expect(splitByCommaOutsideParens('calc(100% - (20px + 10px)),1px 1px black')).toEqual([
        'calc(100% - (20px + 10px))',
        '1px 1px black'
      ]);
    });

    it('handles multiple nested function calls', () => {
      expect(splitByCommaOutsideParens('var(--a, calc(100% - 10px)),var(--b, rgba(0,0,0,1))')).toEqual([
        'var(--a, calc(100% - 10px))',
        'var(--b, rgba(0,0,0,1))'
      ]);
    });
  });

  describe('CSS box-shadow values', () => {
    it('splits multiple simple shadows', () => {
      expect(splitByCommaOutsideParens('1px 1px 3px black,2px 2px 5px rgba(0,0,0,0.3)')).toEqual([
        '1px 1px 3px black',
        '2px 2px 5px rgba(0,0,0,0.3)'
      ]);
    });

    it('handles var() as complete shadow value', () => {
      expect(splitByCommaOutsideParens('var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15))')).toEqual([
        'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15))'
      ]);
    });

    it('handles var() with multiple shadows in fallback', () => {
      expect(splitByCommaOutsideParens('var(--shadows, 1px 1px 3px black, 2px 2px 5px rgba(0,0,0,0.3))')).toEqual([
        'var(--shadows, 1px 1px 3px black, 2px 2px 5px rgba(0,0,0,0.3))'
      ]);
    });

    it('handles mixed var() and plain shadows', () => {
      expect(splitByCommaOutsideParens('var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.1)),1px 1px 3px black')).toEqual([
        'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.1))',
        '1px 1px 3px black'
      ]);
    });

    it('handles inset shadows', () => {
      expect(splitByCommaOutsideParens('inset 0 1px 3px rgba(0,0,0,0.2),0 1px 2px rgba(0,0,0,0.1)')).toEqual([
        'inset 0 1px 3px rgba(0,0,0,0.2)',
        '0 1px 2px rgba(0,0,0,0.1)'
      ]);
    });

    it('handles shadow with all 6 parts (inset + values)', () => {
      expect(splitByCommaOutsideParens('inset 2px 2px 4px 1px rgba(0,0,0,0.5)')).toEqual([
        'inset 2px 2px 4px 1px rgba(0,0,0,0.5)'
      ]);
    });

    it('handles multiple shadows with mixed functions', () => {
      expect(
        splitByCommaOutsideParens(
          'var(--shadow, 0 2px 4px rgba(0,0,0,0.1)),inset 0 1px 3px rgba(0,0,0,0.2),0 0 0 1px rgba(0,0,0,0.05)'
        )
      ).toEqual([
        'var(--shadow, 0 2px 4px rgba(0,0,0,0.1))',
        'inset 0 1px 3px rgba(0,0,0,0.2)',
        '0 0 0 1px rgba(0,0,0,0.05)'
      ]);
    });

    it('handles hsl() color in shadow', () => {
      expect(splitByCommaOutsideParens('0 1px 3px hsl(220, 90%, 56%)')).toEqual(['0 1px 3px hsl(220, 90%, 56%)']);
    });

    it('handles multiple shadows with hsl()', () => {
      expect(splitByCommaOutsideParens('0 1px 3px hsl(220, 90%, 56%),0 2px 8px hsl(340, 82%, 52%)')).toEqual([
        '0 1px 3px hsl(220, 90%, 56%)',
        '0 2px 8px hsl(340, 82%, 52%)'
      ]);
    });

    it('handles currentColor keyword', () => {
      expect(splitByCommaOutsideParens('0 1px 3px currentColor,0 2px 8px black')).toEqual([
        '0 1px 3px currentColor',
        '0 2px 8px black'
      ]);
    });
  });

  describe('edge cases', () => {
    it('handles trailing comma', () => {
      expect(splitByCommaOutsideParens('a,b,c,')).toEqual(['a', 'b', 'c']);
    });

    it('handles leading comma', () => {
      expect(splitByCommaOutsideParens(',a,b')).toEqual(['', 'a', 'b']);
    });

    it('handles consecutive commas', () => {
      expect(splitByCommaOutsideParens('a,,b')).toEqual(['a', '', 'b']);
    });

    it('handles only commas', () => {
      expect(splitByCommaOutsideParens(',,,')).toEqual(['', '', '']);
    });

    it('handles unbalanced parentheses (extra open)', () => {
      expect(splitByCommaOutsideParens('var(--a, 1px 1px black),b')).toEqual(['var(--a, 1px 1px black)', 'b']);
    });

    it('handles parentheses without commas', () => {
      expect(splitByCommaOutsideParens('rgba(0,0,0,1)')).toEqual(['rgba(0,0,0,1)']);
    });

    it('handles empty parentheses', () => {
      expect(splitByCommaOutsideParens('(),a')).toEqual(['()', 'a']);
    });

    it('handles nested empty parentheses', () => {
      expect(splitByCommaOutsideParens('(()),a')).toEqual(['(())', 'a']);
    });
  });
});

describe('splitBySpaceOutsideParens', () => {
  describe('basic values', () => {
    it('splits simple space-separated values', () => {
      expect(splitBySpaceOutsideParens('1px 2px 3px black')).toEqual(['1px', '2px', '3px', 'black']);
    });

    it('handles single value', () => {
      expect(splitBySpaceOutsideParens('black')).toEqual(['black']);
    });

    it('returns empty array for empty string', () => {
      expect(splitBySpaceOutsideParens('')).toEqual([]);
    });

    it('handles multiple spaces between values', () => {
      expect(splitBySpaceOutsideParens('1px   2px   3px')).toEqual(['1px', '2px', '3px']);
    });

    it('handles leading and trailing spaces', () => {
      expect(splitBySpaceOutsideParens('  1px 2px  ')).toEqual(['1px', '2px']);
    });
  });

  describe('parenthesized values', () => {
    it('does not split spaces inside parentheses', () => {
      expect(splitBySpaceOutsideParens('rgba(0, 0, 0, 1)')).toEqual(['rgba(0, 0, 0, 1)']);
    });

    it('does not split spaces inside nested parentheses', () => {
      expect(splitBySpaceOutsideParens('var(--shadow, 0 4px 12px rgba(0, 0, 0, 0.15))')).toEqual([
        'var(--shadow, 0 4px 12px rgba(0, 0, 0, 0.15))'
      ]);
    });

    it('handles calc() with spaces', () => {
      expect(splitBySpaceOutsideParens('calc(100% - 20px)')).toEqual(['calc(100% - 20px)']);
    });

    it('handles multiple functions', () => {
      expect(splitBySpaceOutsideParens('var(--a) var(--b)')).toEqual(['var(--a)', 'var(--b)']);
    });
  });

  describe('CSS box-shadow parts', () => {
    it('splits shadow with 5 parts', () => {
      expect(splitBySpaceOutsideParens('1px 1px 3px 1px black')).toEqual(['1px', '1px', '3px', '1px', 'black']);
    });

    it('splits inset shadow with 6 parts', () => {
      expect(splitBySpaceOutsideParens('inset 2px 2px 4px 1px rgba(0,0,0,0.5)')).toEqual([
        'inset',
        '2px',
        '2px',
        '4px',
        '1px',
        'rgba(0,0,0,0.5)'
      ]);
    });

    it('does not split inside rgba()', () => {
      expect(splitBySpaceOutsideParens('1px 1px 3px rgba(0, 0, 0, 0.5)')).toEqual([
        '1px',
        '1px',
        '3px',
        'rgba(0, 0, 0, 0.5)'
      ]);
    });

    it('does not split inside var() fallback', () => {
      expect(splitBySpaceOutsideParens('var(--shadow, 0 4px 12px rgba(0,0,0,0.15))')).toEqual([
        'var(--shadow, 0 4px 12px rgba(0,0,0,0.15))'
      ]);
    });

    it('does not split inside hsl()', () => {
      expect(splitBySpaceOutsideParens('1px 1px 3px hsl(220, 90%, 56%)')).toEqual([
        '1px',
        '1px',
        '3px',
        'hsl(220, 90%, 56%)'
      ]);
    });

    it('handles shadow with currentColor', () => {
      expect(splitBySpaceOutsideParens('0 1px 3px currentColor')).toEqual(['0', '1px', '3px', 'currentColor']);
    });
  });

  describe('edge cases', () => {
    it('handles only spaces', () => {
      expect(splitBySpaceOutsideParens('   ')).toEqual([]);
    });

    it('handles unbalanced parentheses (treats as single unit)', () => {
      expect(splitBySpaceOutsideParens('var(--a b c')).toEqual(['var(--a b c']);
    });

    it('handles empty parentheses', () => {
      expect(splitBySpaceOutsideParens('() 1px 2px')).toEqual(['()', '1px', '2px']);
    });

    it('handles nested empty parentheses', () => {
      expect(splitBySpaceOutsideParens('(()) 1px')).toEqual(['(())', '1px']);
    });

    it('handles mixed parentheses and plain values', () => {
      expect(splitBySpaceOutsideParens('1px rgba(0, 0, 0, 1) 2px calc(100% - 10px)')).toEqual([
        '1px',
        'rgba(0, 0, 0, 1)',
        '2px',
        'calc(100% - 10px)'
      ]);
    });
  });
});
