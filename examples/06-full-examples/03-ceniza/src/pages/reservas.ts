import {
  button,
  container,
  form,
  heading,
  named,
  on,
  onClick,
  onSubmit,
  paragraph,
  resetForm,
  runServerAction,
  setState,
  text,
  updateElement,
  when,
  whenFailed
} from '@plitzi/sdk-authoring';

import { AVAILABILITY_ACTION, BOOKING_ACTION, slotId } from '../actions';
import { bookingTimes, faqs, photos, restaurant } from '../content';
import {
  arrow,
  closeMenuOnLoad,
  externalLink,
  eyebrow,
  faqList,
  field,
  hours,
  icon,
  infoRow,
  label,
  linkTo,
  noteItem,
  pageHero,
  section,
  sectionHead,
  shell
} from '../layout';

import type { ElementSpec, PageSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * Booking in two steps, with the free times shown live.
 *
 * 1. **Day and party.** Changing either asks the server which times are free (`consultar-disponibilidad`) and draws
 *    them as buttons: free, nearly full with the seats left, full, or closed.
 * 2. **Your details.** Pressing a free time keeps it and opens the form, headed by what was chosen.
 *
 * What was chosen lives in `runtime.state` — `bookingDate`, `bookingPeople`, `bookingTime` — and the booking reads it
 * from there (`{{ state.bookingTime }}`). A form field bound to that state would not do: a control takes a bound
 * default once, and picking a second time would still submit the first.
 */

const PEOPLE = ['1', '2', '3', '4', '5', '6', '7', '8'];

const options = (values: string[], caption: (value: string) => string) =>
  values.map(value => ({ value, label: caption(value) }));

const keep = (key: string, value: string): StepSpec => setState({ key, type: 'text', value });

const pickedKey = (time: string): string => `slotPicked${slotId(time)}`;

/** Which time is chosen, one boolean per time: `chosen` pressed, every other released. `''` releases them all. */
const markPicked = (chosen: string): StepSpec[] =>
  bookingTimes.map(time => setState({ key: pickedKey(time), type: 'boolean', value: time === chosen }));

/**
 * Where one flow reads the day and the party size from.
 *
 * Within a flow, `when` and every template see `runtime.state` as it was when the flow STARTED: a `setState` early in
 * the flow is not visible to a step later in it. So the flow that CHANGES a value passes its own trigger's value
 * (`{{dateChanged.value}}`), and reads from state only what an earlier flow left there.
 */
interface AvailabilityQuery {
  fecha: string;
  personas: string;
  /** The field the guards test for "a day has been chosen" — the trigger's value, or the state key. */
  dayField: string;
}

const FROM_STATE: AvailabilityQuery = {
  fecha: '{{ state.bookingDate }}',
  personas: '{{ state.bookingPeople }}',
  dayField: 'state.bookingDate'
};

/**
 * The steps that ask the server which times are free.
 *
 * Everything after the call answers to TWO conditions: a day has been chosen, and what came back. The party-size
 * select runs these same steps before anybody has picked a day, and a call that never happened must be neither
 * drawn nor reported as one that failed. A day cleared from the calendar takes the times with it.
 */
const askAvailability = (runId: string, query: AvailabilityQuery = FROM_STATE): StepSpec[] => {
  const answered = (ok: boolean, step: StepSpec): StepSpec =>
    when(
      [
        { field: query.dayField, operator: 'notEmpty', value: '' },
        { field: `${runId}.output.ok`, operator: '=', value: ok }
      ],
      step,
      'and'
    );
  const unanswered = (step: StepSpec): StepSpec =>
    when(
      [
        { field: query.dayField, operator: 'notEmpty', value: '' },
        { field: `${runId}.status`, operator: '!=', value: 'completed' }
      ],
      step,
      'and'
    );

  return [
    keep('bookingTime', ''),
    ...markPicked(''),
    keep('availabilityError', ''),
    when({ field: query.dayField, operator: 'empty', value: '' }, keep('availabilityShown', '')),
    when(
      { field: query.dayField, operator: 'notEmpty', value: '' },
      named(
        runId,
        runServerAction({
          actionId: AVAILABILITY_ACTION,
          mode: 'await',
          input: { fecha: query.fecha, personas: query.personas }
        })
      )
    ),
    answered(false, keep('availabilityShown', '')),
    answered(false, keep('availabilityError', `{{${runId}.output.message}}`)),
    unanswered(keep('availabilityShown', '')),
    unanswered(
      keep('availabilityError', 'No hemos podido consultar las horas libres. Inténtalo de nuevo en un momento.')
    ),
    answered(true, keep('availabilityMessage', `{{${runId}.output.message}}`)),
    answered(true, keep('availabilityDay', `{{${runId}.output.day}}`)),
    answered(true, keep('availabilityParty', `{{${runId}.output.party}}`)),
    ...bookingTimes.flatMap(time => {
      const id = slotId(time);

      return [
        answered(true, keep(`slotLabel${id}`, `{{${runId}.output.label${id}}}`)),
        answered(true, keep(`slotOpen${id}`, `{{${runId}.output.open${id}}}`))
      ];
    }),
    answered(true, keep('availabilityShown', '1'))
  ];
};

const stepTitle = (number: string, title: string): ElementSpec =>
  container({
    class: 'stepTitle',
    children: [
      text({ content: number, class: 'stepBadge' }),
      heading({ subType: 'h3', content: title, class: 'stepTitleText' })
    ]
  });

/** Step 1: the two controls whose every change asks again. */
const availabilityForm = form({
  id: 'disponibilidad',
  class: 'formGrid',
  method: 'post',
  managedByInteractions: true,
  children: [
    field({
      name: 'fecha',
      label: 'Día',
      subType: 'date',
      flows: [
        [
          named('dateChanged', on('onChange')),
          keep('bookingDate', '{{dateChanged.value}}'),
          ...askAvailability('availabilityByDate', {
            fecha: '{{dateChanged.value}}',
            personas: '{{ state.bookingPeople }}',
            dayField: 'dateChanged.value'
          })
        ]
      ]
    }),
    field({
      name: 'personas',
      label: 'Personas',
      subType: 'select',
      defaultValue: '2',
      options: options(PEOPLE, value => (value === '1' ? '1 persona' : `${value} personas`)),
      flows: [
        [
          named('peopleChanged', on('onChange')),
          keep('bookingPeople', '{{peopleChanged.value}}'),
          ...askAvailability('availabilityByPeople', {
            fecha: '{{ state.bookingDate }}',
            personas: '{{peopleChanged.value}}',
            dayField: 'state.bookingDate'
          })
        ]
      ]
    })
  ]
});

/**
 * One booking time, drawn twice: a button to press while it is free, and a disabled one saying why it is not. The
 * label on both comes from the server — `21:30`, `22:00 · Últimas 4 plazas`, `14:30 · Completo` — so the page never
 * decides what "nearly full" means.
 *
 * The chosen time stays marked through `aria-pressed`, bound to its own state: the same attribute a screen reader
 * announces is the one `customCss` paints, so the two cannot tell different stories.
 */
const slotButtons = (time: string): ElementSpec[] => {
  const id = slotId(time);

  return [
    button({
      subType: 'button',
      content: time,
      class: 'slotChip',
      visible: `state.slotOpen${id}`,
      bind: { content: `state.slotLabel${id}`, ariaPressed: `state.${pickedKey(time)}` },
      flows: [
        [
          onClick(),
          keep('bookingTime', time),
          ...markPicked(time),
          keep('bookingPick', `{{ state.availabilityDay }} a las ${time} · {{ state.availabilityParty }}`),
          keep('bookingError', '')
        ]
      ]
    }),
    button({
      subType: 'button',
      content: time,
      class: 'slotChipFull',
      disabled: true,
      visible: `!state.slotOpen${id}`,
      bind: { content: `state.slotLabel${id}` }
    })
  ];
};

const slotGroup = (title: string, times: string[]): ElementSpec =>
  container({
    class: 'slotGroup',
    children: [
      text({ content: title, class: 'slotGroupLabel' }),
      container({ class: 'slotGrid', children: times.flatMap(time => slotButtons(time)) })
    ]
  });

const onceBooked = (step: StepSpec): StepSpec => when({ field: 'saved.output.ok', operator: '=', value: true }, step);

const onceRefused = (step: StepSpec): StepSpec => when({ field: 'saved.output.ok', operator: '=', value: false }, step);

/**
 * Step 2: who is coming. The day, the time and the party come from state; only the details come from the form.
 *
 * While it is sent the button is disabled and says so (`revertOnFinish` gives it back, so a refusal leaves a button
 * to press again). Accepted: the form is emptied BEFORE it is hidden and the confirmation shown. Refused — the time
 * filled up while the visitor was typing, say — the server's sentence goes above the button. Not answered at all:
 * `whenFailed` says so and gives the phone number.
 */
const bookingForm = form({
  id: 'reserva',
  class: 'form',
  method: 'post',
  managedByInteractions: true,
  noValidate: true,
  flows: [
    [
      named('submitted', onSubmit()),
      keep('bookingError', ''),
      updateElement({ category: 'attribute', key: 'disabled', value: true, revertOnFinish: true }, 'reserva-enviar'),
      updateElement(
        { category: 'attribute', key: 'content', value: 'Guardando tu mesa…', revertOnFinish: true },
        'reserva-enviar'
      ),
      named(
        'saved',
        runServerAction({
          actionId: BOOKING_ACTION,
          mode: 'await',
          input: {
            nombre: '{{submitted.values.nombre}}',
            email: '{{submitted.values.email}}',
            telefono: '{{submitted.values.telefono}}',
            notas: '{{submitted.values.notas}}',
            fecha: '{{ state.bookingDate }}',
            hora: '{{ state.bookingTime }}',
            personas: '{{ state.bookingPeople }}'
          }
        })
      ),
      onceRefused(keep('bookingError', '{{saved.output.message}}')),
      whenFailed(
        'saved',
        keep(
          'bookingError',
          `No hemos podido confirmarte la reserva. Llámanos al ${restaurant.phone} y lo comprobamos contigo.`
        )
      ),
      onceBooked(keep('bookingName', '{{submitted.values.nombre}}')),
      onceBooked(keep('bookingSummary', '{{saved.output.summary}}')),
      onceBooked(keep('bookingMessage', '{{saved.output.message}}')),
      onceBooked(keep('bookingReference', '{{saved.output.reference}}')),
      onceBooked(resetForm('reserva')),
      onceBooked(setState({ key: 'booked', type: 'boolean', value: true }))
    ]
  ],
  children: [
    field({ name: 'nombre', label: 'Nombre y apellidos', subType: 'text', placeholder: 'Ana Torres', minLength: 3 }),
    container({
      class: 'formGrid',
      children: [
        field({ name: 'email', label: 'Email', subType: 'email', placeholder: 'tu@email.com' }),
        field({ name: 'telefono', label: 'Teléfono', subType: 'text', placeholder: '+34 600 000 000', minLength: 9 })
      ]
    }),
    field(
      {
        name: 'notas',
        label: 'Alergias, celebraciones o peticiones',
        subType: 'textarea',
        required: false,
        placeholder: 'Cumpleaños, trona, intolerancias…'
      },
      'textarea'
    ),
    paragraph({
      content: '',
      class: 'formError',
      bind: { content: 'state.bookingError' },
      visible: 'state.bookingError'
    }),
    button({ id: 'reserva-enviar', subType: 'submit', content: 'Confirmar reserva', class: 'buttonWide' }),
    paragraph({ content: 'Cancelación gratuita hasta 24 horas antes.', class: 'formNote' })
  ]
});

const bookingCard = container({
  visible: '!state.booked',
  class: 'formCard',
  children: [
    container({
      class: 'stack',
      children: [
        eyebrow('Reserva online'),
        heading({ id: 'reservas-form-title', subType: 'h2', content: 'Reserva tu mesa', class: 'formTitle' })
      ]
    }),
    stepTitle('1', 'Elige día y personas'),
    paragraph({ content: 'Te enseñamos al momento las horas que quedan libres.', class: 'stepHint' }),
    availabilityForm,
    paragraph({
      content: '',
      class: 'formError',
      bind: { content: 'state.availabilityError' },
      visible: 'state.availabilityError'
    }),
    container({
      visible: 'state.availabilityShown',
      class: 'slotPanel',
      children: [
        paragraph({ content: '', class: 'slotIntro', bind: { content: 'state.availabilityMessage' } }),
        slotGroup(
          'Comida',
          bookingTimes.filter(time => time < '17:00')
        ),
        slotGroup(
          'Cena',
          bookingTimes.filter(time => time >= '17:00')
        )
      ]
    }),
    container({
      visible: 'state.bookingTime',
      class: 'bookingStep',
      children: [
        stepTitle('2', 'Tus datos'),
        container({
          class: 'pickSummary',
          children: [
            icon('fas fa-calendar-check', 'pickIcon'),
            container({
              class: 'stack',
              children: [
                text({ content: 'Tu mesa', class: 'infoLabel' }),
                text({ content: '', class: 'pickValue', bind: { content: 'state.bookingPick' } })
              ]
            })
          ]
        }),
        bookingForm
      ]
    })
  ]
});

const confirmationCard = container({
  visible: 'state.booked',
  class: 'confirmCard',
  children: [
    container({ class: 'confirmIcon', children: [icon('fas fa-check')] }),
    eyebrow('Reserva confirmada'),
    heading({ subType: 'h2', content: '', class: 'formTitle', bind: { content: 'state.bookingName' } }),
    paragraph({ content: '', class: 'sectionLead', bind: { content: 'state.bookingSummary' } }),
    container({
      class: 'stack',
      children: [
        text({ content: 'Código de reserva', class: 'infoLabel' }),
        text({ content: '', class: 'bookingReference', bind: { content: 'state.bookingReference' } })
      ]
    }),
    paragraph({ content: '', class: 'bodyText', bind: { content: 'state.bookingMessage' } }),
    button({
      subType: 'button',
      content: 'Hacer otra reserva',
      class: 'buttonGhost',
      // The free times are asked for again: the table just booked is one fewer seat at that time.
      flows: [
        [onClick(), setState({ key: 'booked', type: 'boolean', value: false }), ...askAvailability('availabilityAgain')]
      ]
    })
  ]
});

export const reservas: PageSpec = {
  id: 'reservas',
  name: 'Reservas',
  slug: 'reservas',
  seoTitle: 'Reservar mesa — Ceniza',
  seoDescription:
    'Reserva tu mesa en Ceniza, cocina de fuego y temporada en Madrid, viendo al momento las horas libres.',
  class: 'page',
  flows: closeMenuOnLoad(
    keep('bookingDate', ''),
    keep('bookingPeople', '2'),
    keep('bookingTime', ''),
    ...markPicked(''),
    keep('availabilityShown', ''),
    keep('availabilityError', ''),
    keep('bookingError', ''),
    setState({ key: 'booked', type: 'boolean', value: false })
  ),
  body: shell('reservas', [
    pageHero({
      id: 'reservas-hero',
      titleId: 'reservas-title',
      photoId: photos.pouring,
      alt: 'Bartender sirviendo un cóctel en la barra',
      kicker: 'Reservas',
      title: 'Te guardamos sitio junto al fuego',
      lead: 'Elige día y personas y verás al momento las horas libres. Para grupos de más de 8, te preparamos una propuesta.'
    }),
    section([
      container({
        class: 'bookingGrid',
        children: [
          container({ class: 'form', children: [bookingCard, confirmationCard] }),
          container({
            class: 'infoCard',
            children: [
              container({
                class: 'stack',
                children: [
                  eyebrow('Información'),
                  heading({ subType: 'h2', content: 'Horario y contacto', class: 'formTitle' })
                ]
              }),
              hours('reservasHours'),
              infoRow('fas fa-location-dot', 'Dirección', text({ content: restaurant.address, class: 'infoValue' })),
              infoRow(
                'fas fa-phone',
                'Teléfono',
                externalLink(restaurant.phoneHref, 'infoLink', [label(restaurant.phone)])
              ),
              infoRow(
                'fas fa-envelope',
                'Email',
                externalLink(`mailto:${restaurant.email}`, 'infoLink', [label(restaurant.email)])
              ),
              container({
                class: 'noteList',
                children: [
                  noteItem('Mantenemos la mesa durante 15 minutos.'),
                  noteItem('Reservas online hasta 90 días antes y hasta 8 personas.'),
                  noteItem('Menú degustación: último pase a las 14:30 y a las 21:30.'),
                  noteItem('Espacio accesible y tronas disponibles.')
                ]
              }),
              linkTo('/eventos', 'textLink', [label('Grupos y eventos privados'), arrow()])
            ]
          })
        ]
      })
    ]),
    section(
      [
        sectionHead('Antes de reservar', 'Preguntas frecuentes', undefined, 'reservas-faq-title'),
        faqList('faqReservas', faqs.reservas)
      ],
      'sectionTight'
    )
  ])
};
