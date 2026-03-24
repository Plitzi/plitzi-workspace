import { describe, it, expect } from 'vitest';

import isValidValue from './isValueValid';

import type { TagType } from '@plitzi/sdk-shared';

describe('isValidValue', () => {
  const nonElement: TagType = 'class';
  const element: TagType = 'element';

  // ---------------------------
  // NON-ELEMENT
  // ---------------------------

  describe('non-element types', () => {
    it('accepts object when no path', () => {
      expect(isValidValue(nonElement, undefined, { color: 'red' })).toBe(true);
    });

    it('accepts undefined when no path', () => {
      expect(isValidValue(nonElement, undefined, undefined)).toBe(true);
    });

    it('rejects primitive when no path', () => {
      expect(isValidValue(nonElement, undefined, 'red')).toBe(false);
    });

    it('accepts primitive when path exists', () => {
      expect(isValidValue(nonElement, 'color', 'red')).toBe(true);
    });

    it('rejects object when path exists', () => {
      expect(isValidValue(nonElement, 'color', { color: 'red' })).toBe(false);
    });

    it('rejects array', () => {
      expect(isValidValue(nonElement, undefined, [])).toBe(false);
    });

    it('rejects null', () => {
      expect(isValidValue(nonElement, undefined, null)).toBe(false);
    });
  });

  // ---------------------------
  // ELEMENT
  // ---------------------------

  describe('element type', () => {
    it('accepts primitive when path exists', () => {
      expect(isValidValue(element, 'color', 'red')).toBe(true);
    });

    it('accepts undefined when no path', () => {
      expect(isValidValue(element, undefined, undefined)).toBe(true);
    });

    it('accepts undefined when path', () => {
      expect(isValidValue(element, undefined, { base: {} }, 2)).toBe(true);
    });

    it('rejects object when path exists', () => {
      expect(isValidValue(element, 'color', { base: { color: 'red' } })).toBe(false);
    });

    it('rejects nested object when no path', () => {
      expect(isValidValue(element, undefined, { base: { color: 'red' }, header: { background: 'blue' } })).toBe(false);

      expect(
        isValidValue(element, undefined, { base: { test: { color: 'red' } }, header: { background: 'blue' } })
      ).toBe(false);
    });

    it('rejects primitive when no path', () => {
      expect(isValidValue(element, undefined, 'red')).toBe(false);
    });

    it('rejects array when no path', () => {
      expect(isValidValue(element, undefined, [])).toBe(false);
    });

    it('rejects null when no path', () => {
      expect(isValidValue(element, undefined, null)).toBe(false);
    });

    it('rejects nested array values', () => {
      expect(isValidValue(element, undefined, { base: [] })).toBe(false);
    });
  });
});
