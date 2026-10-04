/**
 * An accordion — questions whose answers open one at a time — written once and mapped over the questions: the open one
 * is a key in `state`, and each question reads it the same way. The button says whether its answer is open
 * (`ariaExpanded`) and which panel it opens (`controls`, by the panel's id), so a screen reader follows it; the panel is
 * revealed by the state, so it starts hidden.
 */
import { bindTemplate, button, container, onClick, paragraph, setState, styles } from '@plitzi/sdk-authoring';

import type { ElementSpec, SpaceSpec } from '@plitzi/sdk-authoring';

const QUESTIONS = [
  { id: 'shipping', question: 'How long does shipping take?', answer: 'Three working days, anywhere in Europe.' },
  { id: 'returns', question: 'Can I return an order?', answer: 'Within thirty days, unopened, at no cost.' },
  { id: 'warranty', question: 'Is there a warranty?', answer: 'Two years on every product we sell.' }
];

const question = styles('faq-question', {
  css: {
    display: 'flex',
    'justify-content': 'space-between',
    width: '100%',
    padding: '16px 0px',
    border: 'none',
    'background-color': 'transparent',
    'font-size': '16px',
    'font-weight': '600',
    cursor: 'pointer'
  },
  states: { 'focus-visible': { outline: '2px solid currentColor', 'outline-offset': '2px' } }
});

const answer = styles('faq-answer', { 'padding-bottom': '16px', margin: '0px' });

/** One question: the button that opens it — closing the one open, or this one again — and the answer it opens. */
const faqItem = ({ id, question: words, answer: text }: (typeof QUESTIONS)[number]): ElementSpec[] => [
  button({
    id: `${id}-question`,
    content: words,
    class: question,
    // Named by the panel's id: authoring gives the panel the anchor the page needs for `aria-controls`.
    controls: `${id}-answer`,
    ariaExpanded: false,
    bind: [bindTemplate('ariaExpanded', 'state.faq', `{{ source == '${id}' }}`, { returns: 'value' })],
    flows: [[onClick(), setState({ key: 'faq', type: 'text', value: `{{ state.faq == '${id}' ? '' : '${id}' }}` })]]
  }),
  // Revealed by the state, so it starts hidden: nothing flashes open before the page knows which one is.
  container({
    id: `${id}-answer`,
    visible: { source: 'state.faq', template: `{{ source == '${id}' }}` },
    children: [paragraph({ content: text, class: answer })]
  })
];

export const recipe: SpaceSpec = {
  name: 'Questions',
  permanentUrl: 'questions',
  pages: [{ id: 'home', name: 'Home', slug: '', body: QUESTIONS.flatMap(faqItem) }]
};
