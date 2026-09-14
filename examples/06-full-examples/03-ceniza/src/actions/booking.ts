import { defineAction } from '@plitzi/sdk-authoring';

import { restaurant } from '../content';
import { seatsKey } from './availability';
import { checkEmail, literal, MAX_DAYS_AHEAD, SEATS_PER_SLOT, setUpDay, slotState, SMTP_CREDENTIAL } from './rules';

import type { ActionStepSpec } from '@plitzi/sdk-authoring';

export const BOOKING_ACTION = 'reservar-mesa';

const DAY_SECONDS = 24 * 60 * 60;

/** A seat counter outlives the latest day it can be for. Set once, when the first booking creates it. */
const SEATS_TTL = (MAX_DAYS_AHEAD + 1) * DAY_SECONDS;

/** A booking is kept a month past the latest date it can be for, and then it is gone. */
const BOOKING_TTL = (MAX_DAYS_AHEAD + 30) * DAY_SECONDS;

/** The counter of the time the review accepted — built from its checked date and time, never from the raw input. */
const SEATS_KEY = seatsKey('{{ checked.value.date }}', '{{ checked.value.slotId }}');

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const onlyIf = (field: string, value: string | boolean): ActionStepSpec['when'] => ({
  combinator: 'and',
  rules: [{ field, operator: '=', value }]
});

/**
 * Everything the page already showed, checked again: the page is a convenience and this is the rule — a request can
 * reach `/_action` without ever loading it.
 *
 * What the visitor did wrong comes back as `{ ok: false, message }` rather than as a failed run: it is an answer the
 * page shows, in the restaurant's words. What passes carries only values derived from checked input — the date that
 * parsed back to itself and a time found among the booking times — so the steps after it can build a key from them.
 */
const review = [
  setUpDay('input.fecha', 'input.personas'),
  '{% set name = input.nombre|trim %}',
  '{% set email = input.email|trim %}',
  checkEmail('email'),
  `{% set digits = input.telefono|split("")|filter(character => character in ${literal(DIGITS)})|length %}`,
  '{% set hour = input.hora|trim %}',
  '{% set slot = slots|filter(candidate => candidate.time == hour)|first %}',
  '{% set slotProblem = "Elige una de las horas disponibles." %}',
  '{% if slot %}',
  slotState('slot'),
  '{% set slotProblem = gone ? "Esa hora ya ha pasado. Elige otra." : (not open ? "El " ~ spokenDay ~ " a las " ~ slot.time ~ " la cocina está cerrada. Ese día abrimos de " ~ weekSentence[weekday] ~ "." : "") %}',
  '{% endif %}',
  '{% set reason = name|length < 3 ? "Necesitamos tu nombre para guardar la mesa." : (not emailValid ? "Revisa el email: te enviaremos ahí la confirmación." : (digits < 9 ? "Revisa el teléfono: te llamamos si hay algún cambio." : (problem ? problem : slotProblem))) %}',
  '{% if reason %}{"ok": false, "message": "{{ reason }}"}',
  '{% else %}{"ok": true, "date": "{{ date }}", "slotId": "{{ slot.id }}", "time": "{{ slot.time }}", "party": "{{ party }}", ',
  '"summary": "Mesa para {{ party }} el {{ spokenDay }} a las {{ slot.time }}."}{% endif %}'
].join('');

const reply = [
  '{% if not checked.value.ok %}{"ok": false, "message": "{{ checked.value.message }}"}',
  '{% elseif fits.value == "no" %}{"ok": false, "message": "Las {{ checked.value.time }} se acaban de completar para {{ checked.value.party }}. Elige otra hora."}',
  '{% else %}{"ok": true, "reference": "{{ reference.value }}", "summary": "{{ checked.value.summary }}", ',
  `"message": ${literal(`Te hemos enviado la confirmación por email. Si necesitas cambiar algo, llámanos al ${restaurant.phone}.`)}}`,
  '{% endif %}'
].join('');

const confirmation = [
  'Hola, {{ input.nombre|trim }}:',
  '',
  'Te esperamos. {{ checked.value.summary }}',
  'Código de reserva: {{ reference.value }}',
  '',
  `Mantenemos la mesa durante 15 minutos. Si necesitas cambiar algo, llámanos al ${restaurant.phone} o responde a este email.`,
  '',
  `${restaurant.name} · ${restaurant.address}`
].join('\n');

/**
 * A table, booked for real.
 *
 * The seats are counted INSIDE the write, with the one operation that cannot race: `kv.increment` adds the party to the
 * time's counter and answers the new total in a single step. Two people choosing the last table at the same moment
 * both saw it free on the page; both add, only one total is within the room, and the other gives its seats straight
 * back. Nothing here reads a count and then writes it.
 *
 * The booking is kept before the confirmation is sent, so a mail that cannot leave never loses a table somebody has.
 */
export const bookingAction = defineAction({
  id: BOOKING_ACTION,
  name: 'Reservar mesa',
  description: 'Comprueba la reserva contra el horario y las plazas libres, la guarda y envía la confirmación.',
  trigger: {
    type: 'call',
    access: 'public',
    input: {
      nombre: { type: 'text', required: true, label: 'Nombre y apellidos' },
      email: { type: 'text', required: true, label: 'Email' },
      telefono: { type: 'text', required: true, label: 'Teléfono' },
      personas: { type: 'number', required: true, label: 'Personas' },
      fecha: { type: 'text', required: true, label: 'Fecha (YYYY-MM-DD)' },
      hora: { type: 'text', required: true, label: 'Hora (HH:MM)' },
      notas: { type: 'text', label: 'Notas' }
    }
  },
  steps: [
    { id: 'review', task: 'transform.template', params: { template: review } },
    { id: 'checked', task: 'transform.json', params: { value: '{{ review.value }}' } },
    {
      id: 'seats',
      task: 'kv.increment',
      params: {
        key: SEATS_KEY,
        amount: '{{ input.personas }}',
        ttlSeconds: String(SEATS_TTL)
      },
      when: onlyIf('checked.value.ok', true)
    },
    {
      id: 'fits',
      task: 'transform.template',
      params: { template: `{{ seats.value <= ${SEATS_PER_SLOT} ? "yes" : "no" }}` },
      when: onlyIf('checked.value.ok', true)
    },
    {
      id: 'released',
      task: 'kv.increment',
      params: { key: SEATS_KEY, amount: '-{{ input.personas }}' },
      when: onlyIf('fits.value', 'no')
    },
    {
      id: 'reference',
      task: 'transform.template',
      params: { template: 'CZ-{{ runId|md5|slice(0, 6)|upper }}' },
      when: onlyIf('fits.value', 'yes')
    },
    {
      id: 'kept',
      task: 'kv.set',
      params: {
        key: 'reserva:{{ reference.value }}',
        value: [
          '{{ checked.value.summary }}',
          'Nombre: {{ input.nombre }}',
          'Email: {{ input.email }}',
          'Teléfono: {{ input.telefono }}',
          'Notas: {{ input.notas }}',
          'Recibida: {{ now }}'
        ].join('\n'),
        ttlSeconds: String(BOOKING_TTL)
      },
      when: onlyIf('fits.value', 'yes')
    },
    {
      id: 'confirmation',
      task: 'email.send',
      params: {
        credential: SMTP_CREDENTIAL,
        to: '{{ input.email }}',
        subject: 'Tu mesa en Ceniza · {{ reference.value }}',
        text: confirmation,
        replyTo: restaurant.email
      },
      when: onlyIf('fits.value', 'yes')
    },
    { id: 'reply', task: 'transform.template', params: { template: reply } },
    { id: 'result', task: 'transform.json', params: { value: '{{ reply.value }}' } }
  ],
  output: '{{ result.value }}'
});
