import { describe, expect, it } from 'vitest';

import { resolveElement, runUnitTests, unit, unitReportText, unitTestProblems } from './index';
import { container, text } from '../../elements';
import { authorSpace, variantFrom } from '../../schema';
import { styles } from '../../style';

import type { Schema } from '@plitzi/sdk-shared';

const pill = styles('pill', { css: { padding: '2px 8px' }, variants: { current: { color: 'green' } } });

/** A space with logic of its own: a greeting by the state, a hidden panel, a variant, a value it computes. */
const { schema } = authorSpace({
  name: 'Logic',
  permanentUrl: 'logic',
  computed: { total: '{{ (state.items ?? [])|length }}' },
  pages: [
    {
      name: 'Home',
      slug: '',
      body: [
        text('Hello {{ state.name }}', { id: 'greeting' }),
        text('{{ computed.total }} items', { id: 'count' }),
        container({
          id: 'panel',
          visible: 'state.open',
          children: [text('Details', { id: 'panel-title' })]
        }),
        text('Plan', {
          id: 'plan',
          class: pill,
          bind: [variantFrom(pill, 'state.plan', { template: "{{ source == 'app' ? 'current' : '' }}" })]
        })
      ]
    }
  ]
});

describe('an element of the document resolved for a state', () => {
  it('reads its templates, its computed values, its variants and whether it shows — around it too', () => {
    expect(resolveElement(schema, 'greeting', { state: { name: 'Ada' } }).attributes.content).toBe('Hello Ada');
    expect(resolveElement(schema, 'count', { state: { items: [1, 2, 3] } }).attributes.content).toBe('3 items');
    expect(resolveElement(schema, 'plan', { state: { plan: 'app' } }).styleVariant).toEqual({ pill: 'current' });
    expect(resolveElement(schema, 'plan', { state: { plan: 'site' } }).styleVariant).toEqual({ pill: '' });
    // Hidden with the panel it is in, shown once it opens.
    expect(resolveElement(schema, 'panel-title', { state: {} }).visible).toBe(false);
    expect(resolveElement(schema, 'panel-title', { state: { open: true } }).visible).toBe(true);
  });

  it('refuses an element no page has, saying where one of a component is read', () => {
    expect(() => resolveElement(schema, 'nowhere')).toThrow(/No element "nowhere" on the space's pages/);
  });
});

describe('the document’s unit tests', () => {
  const tests = [
    unit.test({
      id: 'greets',
      title: 'Greets by name',
      element: 'greeting',
      given: { state: { name: 'Ada' } },
      expect: [unit.attribute('content', 'Hello Ada')]
    }),
    unit.test({
      id: 'closed',
      title: 'The panel starts closed',
      element: 'panel-title',
      expect: [unit.visible(false)]
    }),
    unit.test({
      id: 'lit',
      title: 'App is lit',
      element: 'plan',
      given: { state: { plan: 'site' } },
      expect: [unit.variant('pill', 'current')]
    })
  ];
  const document: Schema = { ...schema, tests: { unit: tests } };

  it('runs those the document keeps, and says what each failed one read', () => {
    const report = runUnitTests(document);

    expect(report).toMatchObject({ passed: 2, failed: 1 });
    expect(unitReportText(report)).toEqual([
      '✓ greets — Greets by name',
      '✓ closed — The panel starts closed',
      '✗ lit — App is lit',
      "  pill's variant current expected, it is its base",
      '2 passed, 1 failed'
    ]);
  });

  it('says every problem of the tests as written before they run', () => {
    expect(
      unitTestProblems(document, [
        ...tests,
        unit.test({ id: 'greets', title: 'Again', element: 'gone', expect: [] }),
        unit.test({ id: 'odd', title: 'Odd', element: 'plan', expect: [unit.style('Background Color', 'red')] })
      ])
    ).toEqual([
      'unit test "greets": its id is another unit test\'s — each has its own',
      'unit test "greets": no element "gone" on the space\'s pages — name one by its id',
      'unit test "greets": it expects nothing, so it holds nothing — say what must be true of gone',
      'unit test "odd": "Background Color" is no CSS property\'s name — background-color, height'
    ]);
  });
});

describe('tests written in the spec', () => {
  it('are kept in the document the space authors to, as written', () => {
    const shows = unit.test({ id: 'shows', title: 'Shows', element: 'greeting', expect: [unit.visible()] });
    const { schema: withTests } = authorSpace({
      name: 'Kept',
      permanentUrl: 'kept',
      tests: { unit: [shows] },
      pages: [{ name: 'Home', slug: '', body: [text('Hi', { id: 'greeting' })] }]
    });

    expect(withTests.tests).toEqual({ unit: [shows] });
    expect(runUnitTests(withTests)).toMatchObject({ passed: 1, failed: 0 });
  });
});
