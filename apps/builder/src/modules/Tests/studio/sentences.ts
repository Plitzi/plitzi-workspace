import type { E2eStep } from '@plitzi/sdk-shared';

/**
 * A step of an e2e test as a person reads it, not as it is stored: "Click [Add to basket]", "Check [Basket] shows
 * “1”" — words, the element as a chip, a value quoted. Written for whoever builds the space, who need not know what a
 * selector or an expectation is.
 */

/** A word, an element of the space (by id), a value — or an element check of the space (by id), said by its title. */
export type SentencePart = { text: string } | { element: string } | { value: string } | { check: string };

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
    case 'expectCheck':
      return check([{ text: 'Check that' }, { check: step.check }, { text: 'holds' }]);
  }
};

/** The element a step is about, when it names one: what the canvas lights while it plays. */
export const stepElementOf = (step: E2eStep): string | undefined => ('element' in step ? step.element : undefined);

/**
 * A step in plain words, its element by the name a person knows it by and an element check by its title: a line of a
 * play's log, a timeline's tooltip.
 */
export const sentenceText = (
  step: E2eStep,
  nameOf: (target: string) => string,
  titleOf: (check: string) => string = check => check
): string =>
  sentenceOf(step)
    .parts.map(part =>
      'element' in part
        ? nameOf(part.element)
        : 'value' in part
          ? `“${part.value}”`
          : 'check' in part
            ? `“${titleOf(part.check)}”`
            : part.text
    )
    .join(' ');

/** An element check's title, as its author gave it — its id when it has none, or when no check is it. */
export const checkTitleOf =
  (checks: readonly { id: string; title: string }[]) =>
  (id: string): string =>
    checks.find(check => check.id === id)?.title || id;
