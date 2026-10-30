import type { E2eStep } from '@plitzi/sdk-shared';

/**
 * A step of an e2e test as a person reads it, not as it is stored: "Click [Add to basket]", "Check [Basket] shows
 * “1”" — words, the element as a chip, a value quoted. Written for whoever builds the space, who need not know what a
 * selector or an expectation is.
 */

export type SentencePart = { text: string } | { element: string } | { value: string };

export type Sentence = { icon: string; check: boolean; parts: SentencePart[] };

const json = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));

export const sentenceOf = (step: E2eStep): Sentence => {
  const act = (icon: string, parts: SentencePart[]): Sentence => ({ icon, check: false, parts });
  const check = (parts: SentencePart[]): Sentence => ({ icon: 'fa-solid fa-circle-check', check: true, parts });
  switch (step.kind) {
    case 'click':
      return act('fa-solid fa-arrow-pointer', [{ text: 'Click' }, { element: step.element }]);
    case 'hover':
      return act('fa-solid fa-hand-pointer', [{ text: 'Point at' }, { element: step.element }]);
    case 'type':
      return act('fa-solid fa-keyboard', [
        { text: 'Type' },
        { value: step.text },
        { text: 'into' },
        { element: step.element }
      ]);
    case 'press':
      return act('fa-solid fa-keyboard', [{ text: 'Press the key' }, { value: step.key }]);
    case 'scroll':
      return act('fa-solid fa-arrows-up-down', [{ text: 'Scroll' }, { element: step.element }]);
    case 'drag':
      return act('fa-solid fa-up-down-left-right', [{ text: 'Drag' }, { element: step.element }]);
    case 'waitFor':
      return act('fa-solid fa-hourglass-half', [{ text: 'Wait for' }, { element: step.element }, { text: 'to show' }]);
    case 'goto':
      return act('fa-solid fa-route', [{ text: 'Go to' }, { value: step.path }]);
    case 'back':
      return act('fa-solid fa-arrow-left', [{ text: 'Go back' }]);
    case 'reload':
      return act('fa-solid fa-rotate-right', [{ text: 'Reload the page' }]);
    case 'setState':
      return act('fa-solid fa-sliders', [
        { text: 'Set' },
        { value: step.key },
        { text: 'to' },
        { value: json(step.value) }
      ]);
    case 'setSource':
      return act('fa-solid fa-database', [
        { text: 'Set the data' },
        { value: step.path },
        { text: 'to' },
        { value: json(step.value) }
      ]);
    case 'tick':
      return act('fa-solid fa-clock', [{ text: 'Let' }, { value: `${String(step.ms / 1000)} s` }, { text: 'pass' }]);
    case 'expectShown':
      return check([{ text: 'Check' }, { element: step.element }, { text: 'is shown' }]);
    case 'expectHidden':
      return check([{ text: 'Check' }, { element: step.element }, { text: 'is hidden' }]);
    case 'expectText':
      return check([
        { text: 'Check' },
        { element: step.element },
        { text: step.exact ? 'reads exactly' : 'shows' },
        { value: step.text }
      ]);
    case 'expectState':
      return check([{ text: 'Check' }, { value: step.key }, { text: 'is' }, { value: json(step.value) }]);
    case 'expectAttribute':
      return check([
        { text: 'Check' },
        { element: step.element },
        { text: 'has' },
        { value: `${step.name} = ${step.value}` }
      ]);
    case 'expectStyle':
      return check([
        { text: 'Check' },
        { element: step.element },
        { text: 'has' },
        { value: `${step.property} ${step.at ?? '='} ${step.value}` }
      ]);
    case 'expectPosition':
      return check([{ text: 'Check that' }, { value: step.relation }]);
  }
};

/** The element a step is about, when it names one: what the canvas lights while it plays. */
export const stepElementOf = (step: E2eStep): string | undefined => ('element' in step ? step.element : undefined);

/** A step in plain words, its element by the name a person knows it by: a line of a play's log. */
export const sentenceText = (step: E2eStep, nameOf: (target: string) => string): string =>
  sentenceOf(step)
    .parts.map(part => ('element' in part ? nameOf(part.element) : 'value' in part ? `“${part.value}”` : part.text))
    .join(' ');
