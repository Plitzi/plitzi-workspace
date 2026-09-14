import { apiContainer, container, heading, image, link, list, paragraph, text } from '@plitzi/sdk-authoring';

import { JOURNAL_ACTION } from '../actions';
import { photos } from '../content';
import {
  arrow,
  closeMenuOnLoad,
  icon,
  label,
  linkTo,
  newsletter,
  pageHero,
  section,
  sectionHead,
  shell
} from '../layout';

import type { Attributes, ElementSpec, PageSpec } from '@plitzi/sdk-authoring';

/**
 * The journal, rendered from data.
 *
 * Every article, card and list here comes out of one server action (`leer-diario`, in `src/actions/journal.ts`): a
 * `render` trigger, so the records are in the HTML the first request answers. One page per article is ONE page —
 * `diario/{{slug}}` — and a new article is a new record, not a new page.
 */

const boundText = (source: string, className?: string): ElementSpec =>
  text({ content: '', ...(className ? { class: className } : {}), bind: { content: source } });

const boundParagraph = (source: string, className: string): ElementSpec =>
  paragraph({ content: '', class: className, bind: { content: source } });

const boundHeading = (source: string, className: string, subType: Attributes<'heading'>['subType']): ElementSpec =>
  heading({ subType, content: '', class: className, bind: { content: source } });

const boundImage = (source: string, className: string, loadMode: 'lazy' | 'eager'): ElementSpec =>
  image({ alt: '', class: className, loadMode, bind: { src: `${source}.src`, alt: `${source}.alt` } });

const boundLink = (source: string, className: string, children: ElementSpec[]): ElementSpec =>
  link({ mode: 'internal', class: className, bind: { href: source }, children });

/**
 * A provider of the journal. Everything under it reads the action's answer by this element's id: `records` and
 * `featured`/`others` for a listing, and — on the article page, where the route names a slug — `record`, `found` and
 * `related`.
 *
 * `subType: 'div'` because a provider left at its default renders no element of its own in a published page: its
 * class would style nothing and its id would find nothing.
 */
export const journalProvider = (id: string, children: ElementSpec[], singleRecord = false): ElementSpec =>
  apiContainer({
    id,
    subType: 'div',
    runtime: 'server',
    action: JOURNAL_ACTION,
    ...(singleRecord ? { singleRecord } : {}),
    class: 'journalProvider',
    children
  });

const meta = (source: string): ElementSpec =>
  container({
    class: 'articleMeta',
    children: [boundText(`${source}.category`, 'articleCategory'), text('·'), boundText(`${source}.dateline`)]
  });

/** The whole card is the link: a reader aims at the picture or the title, not at a "read more" line. */
const articleCard = (source: string): ElementSpec =>
  boundLink(`${source}.url`, 'articleCard', [
    image({ alt: '', class: 'articleImage', loadMode: 'lazy', bind: { src: `${source}.card`, alt: `${source}.alt` } }),
    container({
      class: 'dishBody',
      children: [
        meta(source),
        boundHeading(`${source}.title`, 'articleCardTitle', 'h3'),
        boundParagraph(`${source}.excerpt`, 'dishDescription')
      ]
    })
  ]);

/** Cards for every record the list is bound to: one template, however many articles. */
export const articleList = (id: string, items: string, className: string): ElementSpec =>
  list({ id, source: 'controlled', class: className, bind: { items }, children: [articleCard(`${id}.item`)] });

const featureCard = (source: string): ElementSpec =>
  boundLink(`${source}.url`, 'featureCard', [
    image({
      alt: '',
      class: 'featureImage',
      loadMode: 'eager',
      bind: { src: `${source}.feature`, alt: `${source}.alt` }
    }),
    container({
      class: 'featureBody',
      children: [
        meta(source),
        boundHeading(`${source}.title`, 'featureTitle', 'h2'),
        boundParagraph(`${source}.excerpt`, 'sectionLead'),
        container({ class: 'textLink', children: [label('Leer el artículo'), arrow()] })
      ]
    })
  ]);

export const diario: PageSpec = {
  id: 'diario',
  name: 'Diario',
  slug: 'diario',
  seoTitle: 'Diario — Ceniza',
  seoDescription: 'Historias desde la cocina de Ceniza: productores, fuego, fermentos y temporada.',
  class: 'page',
  flows: closeMenuOnLoad(),
  body: shell('diario', [
    pageHero({
      id: 'diario-hero',
      titleId: 'diario-title',
      photoId: photos.market,
      alt: 'Puesto de mercado con frutas y verduras de temporada',
      kicker: 'Diario',
      title: 'Historias desde la cocina',
      lead: 'Lo que pasa antes de que un plato llegue a la mesa: productores, técnicas, fermentos y temporada.'
    }),
    section([
      journalProvider('journalListing', [
        container({ id: 'diario-featured', class: 'stack', children: [featureCard('journalListing.featured')] }),
        sectionHead('Más historias', 'Del campo, la bodega y la despensa', undefined, 'diario-more-title'),
        articleList('journalOthers', 'journalListing.others', 'pairGrid')
      ])
    ]),
    newsletter('boletinDiario')
  ])
};

/** The hero, bound: the same pieces `pageHero` writes, reading the article instead of a literal. */
const articleHero = (source: string): ElementSpec =>
  container({
    subType: 'section',
    class: 'pageHero',
    children: [
      image({
        alt: '',
        class: 'heroImage',
        fetchPriority: 'high',
        loadMode: 'eager',
        bind: { src: `${source}.cover`, alt: `${source}.alt` }
      }),
      container({ class: 'heroScrim' }),
      container({
        class: 'heroContent',
        children: [
          container({ class: 'heroEyebrow', children: [icon('fas fa-fire'), boundText(`${source}.kicker`)] }),
          boundHeading(`${source}.title`, 'pageHeroTitle', 'h1'),
          boundParagraph(`${source}.excerpt`, 'heroLead')
        ]
      })
    ]
  });

/**
 * One part of an article: its heading, its paragraphs, and the figure or the quote that follows it when the record
 * says so. Both are always in the answer — an empty object where a part has none — so each is shown by its own flag.
 */
const articlePart = (source: string): ElementSpec =>
  container({
    class: 'articlePart',
    children: [
      boundHeading(`${source}.heading`, 'articleHeading', 'h2'),
      list({
        id: 'partParagraphs',
        source: 'controlled',
        class: 'articleParagraphs',
        bind: { items: `${source}.paragraphs` },
        children: [boundParagraph('partParagraphs.item', 'articleText')]
      }),
      container({
        subType: 'figure',
        class: 'articleFigure',
        visible: `${source}.hasFigure`,
        children: [
          boundImage(`${source}.figure`, 'articleFigureImage', 'lazy'),
          boundText(`${source}.figure.caption`, 'articleCaption')
        ]
      }),
      container({
        subType: 'figure',
        class: 'pullQuote',
        visible: `${source}.hasQuote`,
        children: [
          boundParagraph(`${source}.quote.text`, 'pullQuoteText'),
          boundText(`${source}.quote.author`, 'quoteRole')
        ]
      })
    ]
  });

/**
 * Every article, at `diario/<slug>`.
 *
 * `{{slug}}` in the page's own slug is the route param, and a render trigger's input is the page's route params — so
 * the action reads it as `input.slug` with nothing wired between the URL and the flow. A slug nobody wrote renders the
 * second half: a page that says so and points back to the journal.
 */
export const articulo: PageSpec = {
  id: 'articulo',
  name: 'Artículo del diario',
  slug: 'diario/{{slug}}',
  seoTitle: 'Diario — Ceniza',
  seoDescription: 'Historias desde la cocina de Ceniza: productores, fuego, fermentos y temporada.',
  class: 'page',
  flows: closeMenuOnLoad(),
  body: shell('diario', [
    journalProvider(
      'article',
      [
        container({
          class: 'journalProvider',
          visible: 'article.found',
          children: [
            articleHero('article.record'),
            section([
              container({
                subType: 'article',
                class: 'articleBody',
                children: [
                  boundParagraph('article.record.lead', 'articleLead'),
                  list({
                    id: 'articleParts',
                    source: 'controlled',
                    class: 'articleParts',
                    bind: { items: 'article.record.parts' },
                    children: [articlePart('articleParts.item')]
                  }),
                  container({
                    class: 'articleFooter',
                    children: [
                      linkTo('/diario', 'textLink', [icon('fas fa-arrow-left'), label('Volver al diario')]),
                      linkTo('/reservas', 'buttonPrimary', [label('Reservar mesa')])
                    ]
                  })
                ]
              })
            ]),
            section(
              [
                sectionHead('Sigue leyendo', 'Más historias del diario'),
                articleList('articleRelated', 'article.related', 'pairGrid')
              ],
              'sectionTight'
            )
          ]
        }),
        container({
          class: 'journalProvider',
          visible: '!article.found',
          children: [
            section([
              sectionHead(
                'Diario',
                'No encontramos ese artículo',
                'Puede que haya cambiado de dirección. Todo lo que hemos escrito está en el diario.'
              ),
              linkTo('/diario', 'buttonPrimary', [label('Volver al diario')])
            ])
          ]
        })
      ],
      true
    )
  ])
};
