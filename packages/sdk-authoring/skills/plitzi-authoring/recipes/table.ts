/**
 * A table of data — plans compared — whose rows come from its items and whose columns are `tableColumn`s: a `<table>`
 * with its head, read as a table by a screen reader and a search engine. The plan's name names its row (`rowHeader`);
 * the seats column shows once a button asks for it (`visibleIf` over the state), gone from the head and every row at
 * once; a row's link reads the row in its template with `r.item`, as a binding does.
 */
import {
  button,
  container,
  link,
  styles,
  table,
  tableColumn,
  text,
  toggleState,
  onClick,
  visibleIf
} from '@plitzi/sdk-authoring';

import type { ElementSpec, SpaceSpec } from '@plitzi/sdk-authoring';

const PLANS = [
  { slug: 'site', name: 'Site', price: '9 €', seats: '1' },
  { slug: 'team', name: 'Team', price: '29 €', seats: '5' },
  { slug: 'business', name: 'Business', price: '79 €', seats: '25' }
];

const plansTable = styles('plans-table', { 'max-width': '720px' });

/** The plans, a row each: the plan names its row, its price, its seats while asked for, and a link to its page. */
const plans: ElementSpec = table({
  id: 'plans',
  caption: 'Plans compared',
  class: plansTable,
  items: PLANS,
  itemKey: 'slug',
  row: r => [
    tableColumn({ header: 'Plan', rowHeader: true, children: [text({ from: `${r.item}.name` })] }),
    tableColumn({ header: 'Price', children: [text({ from: `${r.item}.price` })] }),
    tableColumn({
      header: 'Seats',
      visible: visibleIf('state.showSeats', '==', true),
      children: [text({ from: `${r.item}.seats` })]
    }),
    tableColumn({
      header: 'Details',
      children: [
        link({ href: `/plans/{{ ${r.item}.slug }}`, mode: 'external', label: 'The plan’s page', content: 'More' })
      ]
    })
  ]
});

const showSeats = button('Show seats', { id: 'show-seats', flows: [[onClick(), toggleState({ key: 'showSeats' })]] });

export const recipe: SpaceSpec = {
  name: 'Plans',
  permanentUrl: 'plans',
  pages: [{ id: 'home', name: 'Home', slug: '', body: [container({ subType: 'main', children: [showSeats, plans] })] }]
};
