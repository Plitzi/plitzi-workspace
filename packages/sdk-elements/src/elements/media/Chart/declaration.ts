/** Static declaration for Chart: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring';

import type { ChartProps } from './Chart';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ChartAttributes = AuthorableAttributes<ChartProps>;

/** Its words — the axis, the values — as small as a caption, in the colour of the text around it. */
const words = { fill: 'currentColor', 'font-size': '12px', 'font-family': 'inherit' };

const declaration = elementDeclaration<ChartAttributes>()({
  type: 'chart',
  contentAttributes: ['label', 'emptyText'],
  attributeValues: {
    kind: valuesOf<NonNullable<ChartProps['kind']>>()(['bar', 'line', 'area', 'donut']),
    format: valuesOf<NonNullable<ChartProps['format']>>()(['number', 'percent', 'compact'])
  },
  content: {
    attributes: {
      kind: 'bar',
      labelField: 'label',
      valueField: 'value',
      label: '',
      format: 'number',
      showValues: false,
      height: 240,
      emptyText: 'No data yet'
    },
    definition: {
      label: 'Chart',
      description:
        'Draws rows as bars, a line, a filled line or a donut — SVG of its own, nothing to load. Bind its `items` to the ' +
        "rows, as a list is (`bindTemplate('items', source, '{{ … }}', { returns: 'value' })`): records read by " +
        '`labelField` and `valueField`, or plain numbers. It takes its box’s width and its `height`, and the colour of ' +
        'the text around it — its parts (`bar`, `line`, `area`, `point`, `slice`, `grid`, `axisLabel`, `valueLabel`) ' +
        'restyle it. Name it with `label`: a screen reader reads that, and the rows as a table drawn with it.',
      items: [],
      styleSelectors: {
        bar: '',
        line: '',
        area: '',
        point: '',
        slice: '',
        hole: '',
        grid: '',
        axisLabel: '',
        valueLabel: '',
        legend: '',
        empty: ''
      }
    },
    market: {
      category: 'media',
      icon: 'fa-solid fa-chart-column'
    },
    defaultStyle: {
      name: 'Chart',
      style: {
        base: { default: { display: 'block', position: 'relative', width: '100%', margin: '0px' } },
        bar: { default: { fill: 'currentColor' } },
        line: { default: { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5px' } },
        area: { default: { fill: 'currentColor', 'fill-opacity': '0.15' } },
        point: { default: { fill: 'currentColor' } },
        slice: { default: { fill: 'currentColor' } },
        hole: { default: { fill: 'var(--plitzi-chart-hole, transparent)' } },
        grid: { default: { stroke: 'currentColor', 'stroke-opacity': '0.15', 'stroke-width': '1px' } },
        axisLabel: { default: { ...words, 'fill-opacity': '0.7' } },
        valueLabel: { default: words },
        legend: {
          default: {
            display: 'flex',
            'flex-wrap': 'wrap',
            'column-gap': '16px',
            'row-gap': '4px',
            'list-style-type': 'none',
            'padding-left': '0px',
            'margin-top': '12px',
            'font-size': '14px'
          }
        },
        empty: { default: { 'font-size': '14px', opacity: '0.7' } }
      }
    }
  }
});

export default declaration;
