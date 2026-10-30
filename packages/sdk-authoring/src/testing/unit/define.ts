import type { UnitExpectation, UnitTest } from '@plitzi/sdk-shared';

/**
 * Unit tests as code: `unit.test({ … })` and its expectations, `unit.visible(false)`, `unit.attribute('content', '€29')`.
 * The same records the builder writes, kept in the document's `tests.unit`.
 */
export const unit = {
  test: (test: UnitTest): UnitTest => test,
  /** It shows — or, with `false`, it does not: neither it nor an element around it hidden. */
  visible: (value = true): UnitExpectation => ({ kind: 'visible', value }),
  attribute: (name: string, value: unknown): UnitExpectation => ({ kind: 'attribute', name, value }),
  /** A property its style bindings write, as CSS names it. */
  style: (property: string, value: string): UnitExpectation => ({ kind: 'style', property, value }),
  /** One of its classes' variant; an empty value is the class's base. */
  variant: (className: string, value: string): UnitExpectation => ({ kind: 'variant', className, value }),
  state: (key: string, value: unknown): UnitExpectation => ({ kind: 'state', key, value })
};
