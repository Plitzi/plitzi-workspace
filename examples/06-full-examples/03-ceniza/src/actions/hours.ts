import { defineAction } from '@plitzi/sdk-authoring';

import { openingHours } from '../content.ts';
import { literal, setUpClock } from './rules.ts';

export const HOURS_ACTION = 'consultar-horario';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The week as the page lists it, Monday first: `13:30 – 16:00 · 20:00 – 23:30`, or `Cerrado`. */
const days = openingHours.schedule.map(entry => ({
  weekday: WEEKDAYS.indexOf(entry.day),
  label: entry.label,
  times: entry.hours.length ? entry.hours.map(range => range.replace('-', ' – ')).join(' · ') : 'Cerrado'
}));

const answer = [
  setUpClock(),
  `{% set days = ${literal(days)} %}`,
  '{% set open = week[weekdayNow]|filter(range => minutesNow >= range[0] and minutesNow < range[1])|length > 0 %}',
  '{"open": {{ open ? "true" : "false" }}, "status": "{{ open ? "Abierto ahora" : "Ahora cerrado" }}", "records": [',
  '{% for day in days %}',
  '{"label": "{{ day.label }}", "times": "{{ day.times }}", "today": {{ day.weekday == weekdayNow ? "true" : "false" }}}',
  '{{ loop.last ? "" : ", " }}',
  '{% endfor %}]}'
].join('');

/**
 * The week's hours, and whether the kitchen is open right now.
 *
 * A `render` action, so the answer is in the HTML the first request gets — the status included, since "now" is the
 * server's to read and not the browser's, and a page rendered with one clock and hydrated with another is a mismatch.
 * The answer is shared for a minute: that is as fine-grained as "open now" ever needs to be.
 */
export const hoursAction = defineAction({
  id: HOURS_ACTION,
  name: 'Consultar el horario',
  description: 'El horario de la semana y si la cocina está abierta ahora mismo.',
  trigger: { type: 'render', access: 'public', cacheSeconds: 60 },
  steps: [
    { id: 'computed', task: 'transform.template', params: { template: answer } },
    { id: 'result', task: 'transform.json', params: { value: '{{ computed.value }}' } }
  ],
  output: '{{ result.value }}'
});
