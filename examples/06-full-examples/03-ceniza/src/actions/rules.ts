import { bookingTimes, openingHours } from '../content';

/**
 * The restaurant's rules, as the pieces the actions' templates are built from.
 *
 * The actions are documents: every step is a task `sdk-server` ships, and the reasoning a booking needs — which day
 * it is at the restaurant, whether the kitchen is open at 21:30 on a Sunday, how many seats a time has left — is
 * twig, run by `transform.template`. What changes from one restaurant to the next is authored HERE, in TypeScript,
 * and printed into those templates as literals: the hours, the times, the sentences. So a document carries its own
 * tables and needs nothing but the tasks every Plitzi server has — the same documents run in this project and in a
 * space hosted on plitzi.app.
 *
 * Every template writes JSON, and nothing a visitor typed is ever printed into it: only these literals and values
 * derived from checked input (a date that parsed back to itself, a time found in {@link bookingTimes}).
 */

export const SEATS_PER_SLOT = 24;

/** At or under this many seats left, a time says how many — the moment a visitor should stop comparing and choose. */
export const FEW_SEATS = 6;

export const MAX_PEOPLE = 8;

export const MAX_DAYS_AHEAD = 90;

/** `21:30` → `2130`: the part of a key, an output field and a state key that names one booking time. */
export const slotId = (time: string): string => time.replace(':', '');

const toMinutes = (time: string): number => {
  const [hours = '0', minutes = '0'] = time.split(':');

  return Number(hours) * 60 + Number(minutes);
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

/**
 * A value printed into a template as a twig literal.
 *
 * Refused if it carries a character a JSON string would have to escape: the templates print these straight into the
 * JSON they write, and an escaped quote would be one more thing the template has to get right.
 */
const literal = (value: unknown): string => {
  const printed = JSON.stringify(value);
  if (/\\/.test(printed)) {
    throw new Error(`A template literal may not need escaping: ${printed}`);
  }

  return printed;
};

const scheduleFor = (weekday: number) => openingHours.schedule.find(entry => entry.day === WEEKDAYS[weekday]);

/** `[[810, 960], [1200, 1440]]` per weekday, Sunday first. `00:00` closing a range is midnight, the end of the day. */
const openMinutes = WEEKDAYS.map((_, weekday) =>
  (scheduleFor(weekday)?.hours ?? []).map(range => {
    const [from = '', to = ''] = range.split('-');

    return [toMinutes(from), toMinutes(to) || 24 * 60];
  })
);

/** `13:30 a 16:00 y 20:00 a 23:30`, per weekday. */
const openSentence = WEEKDAYS.map((_, weekday) =>
  (scheduleFor(weekday)?.hours ?? []).map(range => range.replace('-', ' a ')).join(' y ')
);

/** `Los lunes descansamos. Elige otro día.` for a day the kitchen does not open, `''` for the others. */
const restSentence = WEEKDAYS.map((_, weekday) => {
  const schedule = scheduleFor(weekday);
  if (!schedule || schedule.hours.length) {
    return '';
  }

  const day = schedule.label.toLowerCase();

  return `Los ${day.endsWith('s') ? day : `${day}s`} descansamos. Elige otro día.`;
});

const slots = bookingTimes.map(time => ({ id: slotId(time), time, minutes: toMinutes(time) }));

/**
 * Sets the restaurant's clock: `week` (the open ranges per weekday, Sunday first), and `weekdayNow` and `minutesNow`
 * read from `now` — the run's own start, in UTC — in the restaurant's zone, whatever zone the server runs in.
 */
export const setUpClock = (): string =>
  [
    `{% set zone = ${literal(openingHours.timeZone)} %}`,
    `{% set week = ${literal(openMinutes)} %}`,
    '{% set weekdayNow = now|date("w", zone) * 1 %}',
    '{% set minutesNow = (now|date("G", zone)) * 60 + (now|date("i", zone)) * 1 %}'
  ].join('');

/**
 * Sets what every booking question starts from: the day asked about, the party, and the restaurant's clock.
 *
 * The date a visitor picked is a calendar date, midnight UTC, so it is read in UTC. `valid` is a date that formats
 * back to exactly what was sent, which rules out both nonsense and `2026-02-30`. `problem` is the first reason nobody
 * can book that day at all.
 */
export const setUpDay = (dateExpression: string, peopleExpression: string): string =>
  [
    setUpClock(),
    `{% set slots = ${literal(slots)} %}`,
    `{% set weekSentence = ${literal(openSentence)} %}`,
    `{% set restSentence = ${literal(restSentence)} %}`,
    `{% set dayNames = ${literal(DAY_NAMES)} %}`,
    `{% set monthNames = ${literal(MONTH_NAMES)} %}`,
    `{% set date = ${dateExpression}|trim %}`,
    `{% set people = ${peopleExpression} * 1 %}`,
    '{% set today = now|date("Y-m-d", zone) %}',
    '{% set valid = date|date("Y-m-d", "UTC") == date %}',
    '{% set daysAhead = valid ? ((date|date("U", "UTC")) - (today|date("U", "UTC"))) / 86400 : 0 %}',
    '{% set weekday = valid ? date|date("w", "UTC") * 1 : 0 %}',
    '{% set spokenDay = valid ? dayNames[weekday] ~ " " ~ (date|date("j", "UTC")) ~ " de " ~ monthNames[(date|date("n", "UTC")) - 1] : "" %}',
    '{% set party = people == 1 ? "1 persona" : people ~ " personas" %}',
    `{% set problem = not (people >= 1 and people <= ${MAX_PEOPLE}) or people != people|round ? ${literal(
      `Reservamos online hasta ${MAX_PEOPLE} personas. Para grupos más grandes, escríbenos.`
    )} : (not valid ? "Elige una fecha en el calendario." : (daysAhead < 0 ? "Esa fecha ya ha pasado. Elige otro día." : (daysAhead > ${MAX_DAYS_AHEAD} ? ${literal(
      `Abrimos las reservas con ${MAX_DAYS_AHEAD} días de antelación como máximo.`
    )} : (week[weekday]|length == 0 ? restSentence[weekday] : "")))) %}`
  ].join('');

/** Whether the kitchen is open at `slot` on the day {@link setUpDay} read, and whether that time has already gone. */
export const slotState = (slot: string): string =>
  [
    `{% set open = week[weekday]|filter(range => ${slot}.minutes >= range[0] and ${slot}.minutes < range[1])|length > 0 %}`,
    `{% set gone = daysAhead == 0 and ${slot}.minutes <= minutesNow %}`
  ].join('');

/**
 * Sets `emailValid` for `expression`: one `@`, something either side of it, a dot in the domain with something
 * either side of that, and no space. Twig has no regular expressions; this is the same shape the booking page's
 * own field asks for, and `email.send` refuses anything that is not one address anyway.
 */
export const checkEmail = (expression: string): string =>
  [
    `{% set emailParts = ${expression}|split("@") %}`,
    '{% set emailDomain = emailParts|last %}',
    `{% set emailValid = emailParts|length == 2 and (emailParts|first)|length > 0 and "." in emailDomain and (emailDomain|split(".")|first)|length > 0 and (emailDomain|split(".")|last)|length > 0 and " " not in ${expression} %}`
  ].join('');

export { literal };
