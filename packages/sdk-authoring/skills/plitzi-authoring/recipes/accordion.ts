/**
 * An accordion — questions whose answers open one at a time — a `list` over the questions, its row a `disclosure` of
 * one group (`name: 'faq'`), so opening one closes the one that was open. Each is the browser's `<details>`: it opens before the page's script runs, find-in-page opens the one holding what was found, and
 * the closed answers are still in the page for search engines. Its summary is the control and its name, and the marker
 * at its end turns as it opens — no state, no `ariaExpanded`.
 */
import {
  container,
  disclosure,
  disclosureSummary,
  list,
  listItem,
  paragraph,
  styles,
  text
} from '@plitzi/sdk-authoring';

import type { ElementSpec, SpaceSpec } from '@plitzi/sdk-authoring';

const QUESTIONS = [
  { question: 'How long does shipping take?', answer: 'Three working days, anywhere in Europe.' },
  { question: 'Can I return an order?', answer: 'Within thirty days, unopened, at no cost.' },
  { question: 'Is there a warranty?', answer: 'Two years on every product we sell.' }
];

const questions = styles('faq-questions', { padding: '0px', margin: '0px', 'list-style': 'none' });

const question = styles('faq-question', {
  css: { padding: '16px 0px', 'font-size': '16px', 'font-weight': '600' },
  states: { 'focus-visible': { outline: '2px solid currentColor', 'outline-offset': '2px' } }
});

const answer = styles('faq-answer', { 'padding-bottom': '16px', margin: '0px' });

/** The questions as data, one row each: its summary, what is pressed, and the answer it shows. */
const faq: ElementSpec = list({
  id: 'faq',
  class: questions,
  items: QUESTIONS,
  row: row =>
    listItem({
      children: [
        disclosure({
          name: 'faq',
          children: [
            disclosureSummary({ class: question, children: [text({ from: `${row.item}.question` })] }),
            paragraph({ from: `${row.item}.answer`, class: answer })
          ]
        })
      ]
    })
});

export const recipe: SpaceSpec = {
  name: 'Questions',
  permanentUrl: 'questions',
  pages: [{ id: 'home', name: 'Home', slug: '', body: [container({ subType: 'main', children: [faq] })] }]
};
