import { defineAction } from '@plitzi/sdk-authoring';

import { bookingTimes } from '../content';
import { FEW_SEATS, SEATS_PER_SLOT, setUpDay, slotId, slotState } from './rules';

export const AVAILABILITY_ACTION = 'consultar-disponibilidad';

/**
 * Seats taken at one time on one day, as the counter the booking keeps. A time nobody has booked has no counter yet,
 * which reads as nothing — and nothing taken is the right answer for it.
 */
export const seatsKey = (date: string, id: string): string => `plazas:${date}:${id}`;

/**
 * The whole answer, as one template.
 *
 * One label and one flag per time, flattened: the page keeps each as its own piece of state (`setState` holds text, a
 * number or a boolean, never an object), so the answer hands them over already one field each. `open` is `'1'` or
 * empty rather than a boolean because it lands in state as text, and the page's `visible` reads an empty string as
 * false.
 */
const answer = [
  setUpDay('input.fecha', 'input.personas'),
  `{% set taken = {${bookingTimes.map(time => `"${slotId(time)}": seats${slotId(time)}.value`).join(', ')}} %}`,
  '{% if problem %}{"ok": false, "message": "{{ problem }}"}{% else %}',
  '{% set free = 0 %}{"ok": true, ',
  '{% for slot in slots %}',
  slotState('slot'),
  `{% set left = ${SEATS_PER_SLOT} - (taken[slot.id]|default(0)) * 1 %}`,
  '{% set left = left < 0 ? 0 : left %}',
  '{% set bookable = open and not gone and left >= people %}',
  `{% set label = not open ? slot.time ~ " · Cerrado" : (gone ? slot.time ~ " · Ya ha pasado" : (left < people ? slot.time ~ " · Completo" : (left > ${FEW_SEATS} ? slot.time : (left == 1 ? slot.time ~ " · Última plaza" : slot.time ~ " · Últimas " ~ left ~ " plazas")))) %}`,
  '{% set free = free + (bookable ? 1 : 0) %}',
  '"label{{ slot.id }}": "{{ label }}", "open{{ slot.id }}": "{{ bookable ? "1" : "" }}", ',
  '{% endfor %}',
  '"day": "{{ spokenDay }}", "party": "{{ party }}", "message": "',
  '{{ free == 0 ? "El " ~ spokenDay ~ " ya no queda sitio para " ~ party ~ ". Prueba otro día o escríbenos." : (free == 1 ? "Queda 1 hora libre" : "Quedan " ~ free ~ " horas libres") ~ " el " ~ spokenDay ~ " para " ~ party ~ ". Elige la tuya." }}',
  '"}{% endif %}'
].join('');

/**
 * Which times are still free on a day, for a party of a given size.
 *
 * One counter read per booking time, then the template that decides. Reading a counter for a day that turns out to be
 * invalid costs nothing and changes nothing: the template refuses the day before any count is used.
 */
export const availabilityAction = defineAction({
  id: AVAILABILITY_ACTION,
  name: 'Consultar disponibilidad',
  description: 'Qué horas quedan libres un día para un número de personas.',
  trigger: {
    type: 'call',
    access: 'public',
    input: {
      fecha: { type: 'text', required: true, label: 'Fecha (YYYY-MM-DD)' },
      personas: { type: 'number', required: true, label: 'Personas' }
    }
  },
  steps: [
    ...bookingTimes.map(time => ({
      id: `seats${slotId(time)}`,
      task: 'kv.get',
      params: { key: seatsKey('{{ input.fecha }}', slotId(time)) }
    })),
    { id: 'computed', task: 'transform.template', params: { template: answer } },
    { id: 'result', task: 'transform.json', params: { value: '{{ computed.value }}' } }
  ],
  output: '{{ result.value }}'
});
