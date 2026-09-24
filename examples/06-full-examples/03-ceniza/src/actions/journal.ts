import { defineAction } from '@plitzi/sdk-authoring';

import { articles, photo } from '../content.ts';

export const JOURNAL_ACTION = 'leer-diario';

const EMPTY_FIGURE = { src: '', alt: '', caption: '' };

const EMPTY_QUOTE = { text: '', author: '' };

/**
 * The journal, as the records the pages bind.
 *
 * Every string a page shows is composed here, because a binding names one field: the dateline, the URL, each image at
 * the size its slot needs. The figure follows an article's first part and the quote its second, so a long read is
 * broken twice at the same beats — and a part without one still carries an empty object, because the answer is
 * interpolated into JSON and an absent value would leave a hole in it.
 */
const records = articles.map(article => ({
  slug: article.slug,
  url: `/diario/${article.slug}`,
  title: article.title,
  category: article.category,
  dateline: `${article.date} · ${article.readTime} de lectura`,
  kicker: `${article.category} · ${article.date} · ${article.readTime} de lectura`,
  card: photo(article.photo, 900),
  feature: photo(article.photo, 1400),
  cover: photo(article.photo, 2000),
  alt: article.alt,
  excerpt: article.excerpt,
  lead: article.lead,
  parts: article.body.map((part, index) => ({
    heading: part.heading,
    paragraphs: part.paragraphs,
    hasFigure: index === 0,
    figure:
      index === 0
        ? { src: photo(article.figure.photo, 1400), alt: article.figure.alt, caption: article.figure.caption }
        : EMPTY_FIGURE,
    hasQuote: index === 1,
    quote: index === 1 ? article.quote : EMPTY_QUOTE
  }))
}));

/**
 * The journal for a page to render, and one article when the route names it.
 *
 * A `render` trigger: it runs while the page is built, and its input is the page's own route params — so on
 * `diario/{{slug}}` the slug arrives without anything wired between the URL and the flow. The articles are the flow's
 * own data (`transform.json`), which is what lets the same document run on any Plitzi server with no store behind it.
 *
 * `found` is what the article page's two halves bind to: a slug nobody wrote is a page that says so, not a failed run.
 */
export const journalAction = defineAction({
  id: JOURNAL_ACTION,
  name: 'Leer el diario',
  description: 'Los artículos del diario, y el que nombra la URL.',
  trigger: {
    type: 'render',
    access: 'public',
    input: { slug: { type: 'text', label: 'Slug' } }
  },
  steps: [{ id: 'articles', task: 'transform.json', params: { value: JSON.stringify(records) } }],
  output: [
    '{% set chosen = articles.value|filter(article => article.slug == input.slug)|first %}',
    '{"records": {{ articles.value|json_encode }}, ',
    '"featured": {{ articles.value|first|json_encode }}, ',
    '"others": {{ articles.value|slice(1)|json_encode }}, ',
    '"found": {{ chosen ? "true" : "false" }}, ',
    '"record": {{ chosen ? chosen|json_encode : "{}" }}, ',
    '"related": {{ articles.value|filter(article => article.slug != input.slug)|json_encode }}}'
  ].join('')
});
