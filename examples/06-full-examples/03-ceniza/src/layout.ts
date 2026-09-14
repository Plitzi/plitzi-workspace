import {
  apiContainer,
  button,
  container,
  fontAwesome,
  form,
  formControl,
  heading,
  image,
  link,
  list,
  named,
  on,
  onClick,
  onSubmit,
  paragraph,
  resetForm,
  runServerAction,
  setState,
  text,
  themeToggle,
  toggleState,
  updateElement,
  when,
  whenFailed
} from '@plitzi/sdk-authoring';

import { HOURS_ACTION, NEWSLETTER_ACTION } from './actions';
import { photo, restaurant } from './content';

import type { Faq, Pillar, ProcessStep } from './content';
import type { Attributes, ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

export type PageKey =
  'inicio' | 'carta' | 'degustacion' | 'vinos' | 'nosotros' | 'eventos' | 'diario' | 'regalar' | 'reservas';

const navItems: { key: PageKey; label: string; href: string }[] = [
  { key: 'carta', label: 'Carta', href: '/carta' },
  { key: 'degustacion', label: 'Degustación', href: '/degustacion' },
  { key: 'vinos', label: 'Vinos', href: '/vinos' },
  { key: 'nosotros', label: 'Nosotros', href: '/nosotros' },
  { key: 'eventos', label: 'Eventos', href: '/eventos' },
  { key: 'diario', label: 'Diario', href: '/diario' }
];

/** The words inside a pill or a link: they inherit every bit of type from the box they sit in. */
export const label = (content: string): ElementSpec => text({ content, class: 'inlineLabel' });

export const icon = (name: string, className?: string): ElementSpec =>
  fontAwesome(className ? { icon: name, class: className } : { icon: name });

export const arrow = (): ElementSpec => icon('fas fa-arrow-right');

/** `internal` is a path this space serves; the default `page` mode would read the href as a page id instead. */
export const linkTo = (href: string, className: string, children: ElementSpec[]): ElementSpec =>
  link({ href, mode: 'internal', class: className, children });

/** `tel:` and `mailto:` are left exactly as written, which only `external` does. */
export const externalLink = (href: string, className: string, children: ElementSpec[]): ElementSpec =>
  link({ href, mode: 'external', class: className, children });

export const eyebrow = (content: string, className = 'eyebrow'): ElementSpec => text({ content, class: className });

export const sectionHead = (kicker: string, title: string, lead?: string, id?: string): ElementSpec =>
  container({
    class: 'sectionHead',
    children: [
      eyebrow(kicker),
      heading({ ...(id ? { id } : {}), subType: 'h2', content: title, class: 'sectionTitle' }),
      ...(lead ? [paragraph({ content: lead, class: 'sectionLead' })] : [])
    ]
  });

export const section = (children: ElementSpec[], className: 'section' | 'sectionTight' = 'section'): ElementSpec =>
  container({ subType: 'section', class: className, children: [container({ class: 'sectionInner', children })] });

export const infoRow = (iconName: string, title: string, value: ElementSpec): ElementSpec =>
  container({
    class: 'infoRow',
    children: [
      container({ class: 'infoIcon', children: [icon(iconName)] }),
      container({ class: 'stack', children: [text({ content: title, class: 'infoLabel' }), value] })
    ]
  });

export const noteItem = (content: string): ElementSpec =>
  container({ class: 'noteItem', children: [icon('fas fa-check', 'noteIcon'), text(content)] });

export const stat = (value: string, caption: string): ElementSpec =>
  container({
    class: 'stat',
    children: [text({ content: value, class: 'statValue' }), text({ content: caption, class: 'statLabel' })]
  });

export const pillarCard = (pillar: Pillar): ElementSpec =>
  container({
    class: 'pillar',
    children: [
      container({ class: 'pillarIcon', children: [icon(pillar.icon)] }),
      heading({ subType: 'h3', content: pillar.title, class: 'pillarTitle' }),
      paragraph({ content: pillar.text, class: 'bodyText' })
    ]
  });

export const processGrid = (steps: ProcessStep[], id?: string): ElementSpec =>
  container({
    ...(id ? { id } : {}),
    class: 'processGrid',
    children: steps.map((step, index) =>
      container({
        class: 'processStep',
        children: [
          text({ content: String(index + 1).padStart(2, '0'), class: 'stepNumber' }),
          heading({ subType: 'h3', content: step.title, class: 'pillarTitle' }),
          paragraph({ content: step.text, class: 'dishDescription' })
        ]
      })
    )
  });

const boundText = (source: string, className?: string): ElementSpec =>
  text({ content: '', ...(className ? { class: className } : {}), bind: { content: source } });

/**
 * The week's hours and whether the kitchen is open right now, answered by the `consultar-horario` render action.
 *
 * Named, because it is one of the things the visual test holds the page to — and ids are unique across the whole
 * document, so each page that shows it passes its own. The id is also the source its children read, so it is a plain
 * name: a hyphen in a binding reads as a minus.
 *
 * "Open" and "today" each change a row's look, and a class cannot read data — so each is drawn twice and the answer
 * picks one with `visible`.
 */
export const hours = (id: string): ElementSpec => {
  const days = `${id}Days`;

  return apiContainer({
    id,
    subType: 'div',
    runtime: 'server',
    action: HOURS_ACTION,
    class: 'hoursBox',
    children: [
      text({ content: '', class: 'hoursStatusOpen', visible: `${id}.open`, bind: { content: `${id}.status` } }),
      text({ content: '', class: 'hoursStatus', visible: `!${id}.open`, bind: { content: `${id}.status` } }),
      list({
        id: days,
        source: 'controlled',
        class: 'hoursList',
        bind: { items: `${id}.records` },
        children: [
          container({
            class: 'hoursRowToday',
            visible: `${days}.item.today`,
            children: [
              container({
                children: [boundText(`${days}.item.label`), text({ content: ' · hoy', class: 'hoursToday' })]
              }),
              boundText(`${days}.item.times`, 'hoursTimes')
            ]
          }),
          container({
            class: 'hoursRow',
            visible: `!${days}.item.today`,
            children: [boundText(`${days}.item.label`), boundText(`${days}.item.times`, 'hoursTimes')]
          })
        ]
      })
    ]
  });
};

/**
 * A form control is made of parts, and `slots` is how a class reaches the ones that are not the wrapper — the
 * input, its label and its error. Dressed through `class` alone, the rule paints the box around the input instead.
 */
/** What each rule says when it is broken, in the site's language: the SDK's own sentences are English. */
const fieldMessages = ({ subType, minLength = 0, maxLength = 0 }: Attributes<'formControl'>) => ({
  requiredMessage: 'Rellena este campo.',
  ...(minLength > 0 ? { minLengthMessage: `Escribe al menos ${minLength} caracteres.` } : {}),
  ...(maxLength > 0 ? { maxLengthMessage: `Escribe como mucho ${maxLength} caracteres.` } : {}),
  ...(subType === 'email' ? { formatMessage: 'Revisa el email: tiene que ser como nombre@dominio.com.' } : {})
});

export const field = (
  attributes: Attributes<'formControl'> & { flows?: StepSpec[][] },
  inputSlot: 'input' | 'textarea' = 'input'
): ElementSpec =>
  formControl({
    required: true,
    ...fieldMessages(attributes),
    ...attributes,
    class: 'field',
    slots: { input: inputSlot, label: 'fieldLabel', error: 'fieldError' }
  });

/**
 * Questions that open in place.
 *
 * Each answer is one piece of state, flipped by one step on one trigger. The question is drawn twice, closed and
 * open, because a class cannot read state and the sign beside the question has to — and each copy says which one it
 * is with `aria-expanded`, which is what a screen reader announces.
 */
export const faqList = (key: string, items: Faq[], id?: string): ElementSpec =>
  container({
    ...(id ? { id } : {}),
    class: 'faqList',
    children: items.map((item, index) => {
      const stateKey = `${key}${index}`;
      const toggle = (): StepSpec[][] => [[onClick(), toggleState({ key: stateKey })]];

      return container({
        class: 'faqItem',
        children: [
          button({
            subType: 'button',
            content: item.question,
            class: 'faqQuestion',
            ariaExpanded: false,
            visible: `!state.${stateKey}`,
            flows: toggle()
          }),
          button({
            subType: 'button',
            content: item.question,
            class: 'faqQuestionOpen',
            ariaExpanded: true,
            visible: `state.${stateKey}`,
            flows: toggle()
          }),
          paragraph({ content: item.answer, class: 'faqAnswer', visible: `state.${stateKey}` })
        ]
      });
    })
  });

/**
 * The seasonal newsletter: an email, sent to the server (`src/actions/newsletter.ts`), and a thank-you in its place.
 *
 * The same three endings as the booking — accepted, refused with the server's sentence, not answered — and the
 * thank-you says what the server said, because "you were already on the list" is a different answer from "welcome".
 * While it is sent the button is disabled and says so, so pressing it again sends nothing twice; `revertOnFinish` gives
 * it back, so a refusal leaves a button to press again. `id` names the form and keys its state, and a page that shows
 * the band passes its own.
 */
export const newsletter = (id: string): ElementSpec => {
  const submitId = `${id}-enviar`;
  const sentKey = `${id}Sent`;
  const messageKey = `${id}Message`;
  const errorKey = `${id}Error`;
  const runId = `${id}Run`;
  const answered = (ok: boolean, step: StepSpec): StepSpec =>
    when({ field: `${runId}.output.ok`, operator: '=', value: ok }, step);

  return container({
    subType: 'section',
    class: 'newsletterBand',
    children: [
      container({
        class: 'newsletterInner',
        children: [
          container({
            class: 'splitText',
            children: [
              eyebrow('Carta de temporada'),
              heading({ subType: 'h2', content: 'Cuatro correos al año, uno por estación.', class: 'newsletterTitle' }),
              paragraph({
                content:
                  'Te escribimos cuando cambia la carta o abrimos fechas para las cenas especiales, antes de anunciarlas. Nada más.',
                class: 'sectionLead'
              })
            ]
          }),
          container({
            visible: `!state.${sentKey}`,
            class: 'stack',
            children: [
              form({
                id,
                class: 'newsletterForm',
                method: 'post',
                managedByInteractions: true,
                noValidate: true,
                flows: [
                  [
                    named(`${id}Submitted`, onSubmit()),
                    setState({ key: errorKey, type: 'text', value: '' }),
                    updateElement(
                      { category: 'attribute', key: 'disabled', value: true, revertOnFinish: true },
                      submitId
                    ),
                    updateElement(
                      { category: 'attribute', key: 'content', value: 'Apuntándote…', revertOnFinish: true },
                      submitId
                    ),
                    named(
                      runId,
                      runServerAction({
                        actionId: NEWSLETTER_ACTION,
                        mode: 'await',
                        input: { email: `{{${id}Submitted.values.email}}` }
                      })
                    ),
                    answered(false, setState({ key: errorKey, type: 'text', value: `{{${runId}.output.message}}` })),
                    whenFailed(
                      runId,
                      setState({
                        key: errorKey,
                        type: 'text',
                        value: 'No hemos podido apuntarte ahora mismo. Inténtalo de nuevo en un momento.'
                      })
                    ),
                    answered(true, setState({ key: messageKey, type: 'text', value: `{{${runId}.output.message}}` })),
                    answered(true, resetForm(id)),
                    answered(true, setState({ key: sentKey, type: 'boolean', value: true }))
                  ]
                ],
                children: [
                  field({ name: 'email', label: 'Tu email', subType: 'email', placeholder: 'tu@email.com' }),
                  button({ id: submitId, subType: 'submit', content: 'Suscribirme', class: 'buttonPrimary' })
                ]
              }),
              paragraph({
                content: '',
                class: 'formError',
                bind: { content: `state.${errorKey}` },
                visible: `state.${errorKey}`
              }),
              paragraph({ content: 'Sin publicidad. Te das de baja con un clic.', class: 'formHint' })
            ]
          }),
          container({
            visible: `state.${sentKey}`,
            class: 'newsletterDone',
            children: [
              container({ class: 'confirmIconSmall', children: [icon('fas fa-check')] }),
              container({
                class: 'stack',
                children: [
                  text({ content: '¡Gracias por apuntarte!', class: 'newsletterDoneTitle' }),
                  text({ content: '', class: 'dishDescription', bind: { content: `state.${messageKey}` } })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
};

interface HeroSpec {
  id: string;
  titleId: string;
  photoId: string;
  alt: string;
  kicker: string;
  title: string;
  lead: string;
  actions?: ElementSpec[];
}

export const pageHero = ({ id, titleId, photoId, alt, kicker, title, lead, actions = [] }: HeroSpec): ElementSpec =>
  container({
    id,
    subType: 'section',
    class: 'pageHero',
    children: [
      image({ src: photo(photoId, 2000), alt, class: 'heroImage', fetchPriority: 'high', loadMode: 'eager' }),
      container({ class: 'heroScrim' }),
      container({
        class: 'heroContent',
        children: [
          container({ class: 'heroEyebrow', children: [icon('fas fa-fire'), text(kicker)] }),
          heading({ id: titleId, subType: 'h1', content: title, class: 'pageHeroTitle' }),
          paragraph({ content: lead, class: 'heroLead' }),
          ...(actions.length ? [container({ class: 'heroActions', children: actions })] : [])
        ]
      })
    ]
  });

/**
 * The header, and the one piece of state every page keeps: whether the phone menu is open.
 *
 * `toggleState` flips it from one step on one trigger. The panel is on screen only while it is true, and every page
 * closes it again on load — a menu that stays open after you picked where to go is a menu you have to close twice.
 */
const header = (active: PageKey): ElementSpec =>
  container({
    subType: 'header',
    class: 'headerBand',
    children: [
      container({
        class: 'headerInner',
        children: [
          linkTo('/', 'brand', [
            container({ class: 'brandMark', children: [icon('fas fa-fire')] }),
            container({
              class: 'stack',
              children: [
                text({ content: restaurant.name, class: 'brandName' }),
                text({ content: restaurant.tagline, class: 'brandTag' })
              ]
            })
          ]),
          container({
            subType: 'nav',
            class: 'nav',
            children: navItems.map(item =>
              linkTo(item.href, item.key === active ? 'navLinkActive' : 'navLink', [label(item.label)])
            )
          }),
          container({
            class: 'headerActions',
            children: [
              themeToggle({ subType: 'switch', lightLabel: 'Claro', darkLabel: 'Oscuro', class: 'themeToggle' }),
              linkTo('/reservas', 'headerCta', [label('Reservar mesa')]),
              button({
                subType: 'button',
                content: 'Menú',
                class: 'menuButton',
                // One button, so the state it flips is bound rather than drawn twice: it says open while the panel is.
                bind: { ariaExpanded: 'state.menuOpen' },
                flows: [[onClick(), toggleState({ key: 'menuOpen' })]]
              })
            ]
          })
        ]
      }),
      container({
        subType: 'nav',
        class: 'mobileMenu',
        visible: 'state.menuOpen',
        children: [
          linkTo('/', 'mobileLink', [label('Inicio'), arrow()]),
          ...navItems.map(item => linkTo(item.href, 'mobileLink', [label(item.label), arrow()])),
          linkTo('/regalar', 'mobileLink', [label('Tarjetas regalo'), arrow()]),
          linkTo('/reservas', 'mobileCta', [label('Reservar mesa')])
        ]
      })
    ]
  });

const footerColumn = (title: string, children: ElementSpec[]): ElementSpec =>
  container({ class: 'footerColumn', children: [text({ content: title, class: 'footerHeading' }), ...children] });

const footerLinks = (items: [string, string][]): ElementSpec[] =>
  items.map(([href, caption]) => linkTo(href, 'footerLink', [label(caption)]));

const footer = (): ElementSpec =>
  container({
    subType: 'footer',
    class: 'footerBand',
    children: [
      container({
        class: 'footerInner',
        children: [
          container({
            class: 'footerTop',
            children: [
              container({
                class: 'footerBrand',
                children: [
                  text({ content: restaurant.name, class: 'footerTitle' }),
                  paragraph({
                    content:
                      'Cocina de fuego y temporada en el barrio de Las Letras. Encina, producto cercano y una mesa sin prisa.',
                    class: 'footerText'
                  }),
                  linkTo('/reservas', 'buttonOnInk', [label('Reservar mesa')])
                ]
              }),
              footerColumn(
                'Comer',
                footerLinks([
                  ['/carta', 'Carta'],
                  ['/degustacion', 'Menú degustación'],
                  ['/vinos', 'Vinos'],
                  ['/reservas', 'Reservas']
                ])
              ),
              footerColumn(
                'La casa',
                footerLinks([
                  ['/nosotros', 'Nosotros'],
                  ['/eventos', 'Eventos privados'],
                  ['/diario', 'Diario'],
                  ['/regalar', 'Tarjetas regalo']
                ])
              ),
              footerColumn('Visítanos', [
                paragraph({ content: restaurant.address, class: 'footerText' }),
                paragraph({ content: 'Metro Antón Martín · Línea 1', class: 'footerText' }),
                externalLink(restaurant.phoneHref, 'footerLink', [label(restaurant.phone)]),
                externalLink(`mailto:${restaurant.email}`, 'footerLink', [label(restaurant.email)])
              ])
            ]
          }),
          container({
            class: 'footerBottom',
            children: [
              text(`© 2026 ${restaurant.name} · Un space de demostración hecho con Plitzi`),
              text('Martes a domingo · Precios con IVA incluido')
            ]
          })
        ]
      })
    ]
  });

/** Every page is the same frame around different content. */
export const shell = (active: PageKey, body: ElementSpec[]): ElementSpec[] => [
  header(active),
  container({ subType: 'main', class: 'main', children: body }),
  footer()
];

/** Every page closes the phone menu on load, and resets whatever else of its own it was handed. */
export const closeMenuOnLoad = (...alsoReset: StepSpec[]): StepSpec[][] => [
  [on('onPageLoad'), setState({ key: 'menuOpen', type: 'boolean', value: false }), ...alsoReset]
];
