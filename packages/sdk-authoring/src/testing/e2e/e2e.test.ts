import { describe, expect, it } from 'vitest';

import { e2e, e2eTestProblems, parseRelation, relationHolds, sidePx, stepText } from './index';
import { button, text } from '../../elements';
import { authorSpace } from '../../schema';
import { readSpaceTests } from '../tests';
import { unit } from '../unit';

const { schema } = authorSpace({
  name: 'Shop',
  permanentUrl: 'shop',
  pages: [
    { name: 'Home', slug: '', body: [text('Welcome', { id: 'welcome' })] },
    {
      name: 'Menu',
      slug: 'menu',
      body: [button({ id: 'add', content: 'Add' }), text('0', { id: 'cart-count' }), text('', { id: 'legend' })]
    }
  ]
});

describe('the document’s e2e tests as written', () => {
  const adds = e2e.test({
    id: 'adds',
    title: 'Adding counts it',
    page: '/menu',
    width: 390,
    steps: [e2e.click('add'), e2e.expectText('cart-count', '1'), e2e.expectPosition('cart-count.bottom <= legend.top')]
  });

  it('holds a test whose page, elements and relations the space has', () => {
    expect(e2eTestProblems(schema, [adds])).toEqual([]);
  });

  it('says every problem before a browser opens: a page, an element, a relation, a clock, a test that holds nothing', () => {
    expect(
      e2eTestProblems(schema, [
        adds,
        e2e.test({
          id: 'adds',
          title: 'Again',
          page: '/checkout',
          width: 90,
          steps: [e2e.click('pay:2'), e2e.tick(1000), e2e.expectPosition('total.bottom over legend.top')]
        })
      ])
    ).toEqual([
      'e2e test "adds": its id is another e2e test\'s — each has its own',
      'e2e test "adds": no page of the space answers /checkout — a path one of its pages has',
      'e2e test "adds": a width of 90 px is no screen\'s — 390, 768 or 1440',
      'e2e test "adds", step 1 (click): no element "pay" in the space — name one by its id',
      'e2e test "adds", step 2 (tick): it moves the page\'s clock, which the test holds only with its own clock',
      'e2e test "adds", step 3 (expectPosition): "total.bottom over legend.top" is no relation: two sides — an element\'s edge (left, right, top, bottom, width, height) give or take px, or px alone — and <=, >=, <, > or =, as "activity.bottom + 8 <= legend.top"'
    ]);
  });

  it('takes a wrong address its space answers with its own not-found page — a flow may start there to test it', () => {
    const { schema: withNotFound } = authorSpace({
      name: 'Shop',
      permanentUrl: 'shop',
      pages: [
        { name: 'Home', slug: '', body: [text('Welcome', { id: 'welcome' })] },
        { name: 'Not found', slug: '*', body: [text('Not here', { id: 'lost' })] }
      ]
    });
    const lost = e2e.test({ id: 'lost', title: 'Lost', page: '/nowhere', steps: [e2e.expectShown('lost')] });

    expect(e2eTestProblems(withNotFound, [lost])).toEqual([]);
    expect(e2eTestProblems(schema, [lost])).toEqual([
      'e2e test "lost": no page of the space answers /nowhere — a path one of its pages has',
      'e2e test "lost", step 1 (expectShown): no element "lost" in the space — name one by its id'
    ]);
  });

  it('says each step as a person reads it', () => {
    expect(adds.steps.map(stepText)).toEqual(['click add', 'cart-count shows "1"', 'cart-count.bottom <= legend.top']);
  });
});

describe('where two elements stand', () => {
  it('reads a relation give or take px, and holds it on the boxes read', () => {
    const relation = parseRelation('activity.bottom + 8 <= legend.top');
    if ('problem' in relation) {
      throw new Error(relation.problem);
    }

    const boxes = new Map([
      ['activity', { x: 22, y: 483, width: 300, height: 132 }],
      ['legend', { x: 22, y: 627, width: 300, height: 253 }]
    ]);
    const [left, right] = [sidePx(relation.left, id => boxes.get(id)), sidePx(relation.right, id => boxes.get(id))];

    expect([left, right]).toEqual([623, 627]);
    expect(relationHolds(623, relation.at, 627)).toBe(true);
    expect(sidePx(relation.right, () => undefined)).toEqual({ missing: 'legend' });
  });
});

describe('a document’s tests read from outside', () => {
  it('reads the records, and says every way something is not one, with where', () => {
    expect(
      readSpaceTests({
        unit: [{ id: 'u', title: 'U', element: 'add', expect: [{ kind: 'visible', value: true }] }],
        e2e: [{ id: 'e', title: 'E', page: '/', steps: [{ kind: 'click', element: 'add' }] }]
      })
    ).toEqual({
      tests: {
        unit: [{ id: 'u', title: 'U', element: 'add', expect: [{ kind: 'visible', value: true }] }],
        e2e: [{ id: 'e', title: 'E', page: '/', steps: [{ kind: 'click', element: 'add' }] }]
      }
    });
    expect(
      readSpaceTests({
        unit: [{ id: 'u', element: 'add', expect: [{ kind: 'shown' }] }],
        e2e: [{ id: 'e', title: 'E', page: '/', width: 'wide', steps: [{ kind: 'drag', element: 'add', dx: 4 }] }]
      })
    ).toEqual({
      problems: [
        'tests.unit[0].title: words',
        'tests.unit[0].expect[0]: one of visible, attribute, style, variant, state',
        'tests.e2e[0].width: a number of px',
        'tests.e2e[0].steps[0].dy: a number'
      ]
    });
    expect(readSpaceTests('none')).toEqual({ problems: ['tests: { unit?: [...], e2e?: [...], accounts?: [...] }'] });
  });

  it('reads a journey that starts with a state and holds an element check, and says either written wrong', () => {
    const journey = {
      id: 'e',
      title: 'E',
      page: '/',
      given: { state: { count: 2 } },
      steps: [{ kind: 'expectCheck', check: 'u' }]
    };
    expect(readSpaceTests({ e2e: [journey] })).toEqual({ tests: { unit: [], e2e: [journey] } });
    expect(readSpaceTests({ e2e: [{ ...journey, given: { count: 2 }, steps: [{ kind: 'expectCheck' }] }] })).toEqual({
      problems: [
        'tests.e2e[0].given: { state: { <key>: <value> } } — the state it starts with',
        'tests.e2e[0].steps[0].check: words'
      ]
    });
  });
});

// The hybrid: a journey drives the page to a case, and an element check of the space holds its logic there.
describe('an element check held inside a journey', () => {
  it('names one of the space’s element checks — the document’s, or those the caller edits', () => {
    const holds = e2e.test({
      id: 'holds',
      title: 'The count reads right once added',
      page: '/menu',
      steps: [e2e.click('add'), e2e.expectCheck('count-reads')]
    });
    const counted = unit.test({ id: 'count-reads', title: 'Count', element: 'cart-count', expect: [unit.visible()] });

    expect(e2eTestProblems(schema, [holds])).toEqual([
      'e2e test "holds", step 2 (expectCheck): no element check of the space is "count-reads" — name one of its tests.unit by its id'
    ]);
    expect(e2eTestProblems(schema, [holds], [counted])).toEqual([]);
    expect(holds.steps.map(stepText)).toEqual(['click add', 'element check count-reads holds']);
  });
});
