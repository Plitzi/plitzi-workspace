import { interactionBasicTriggers } from '@plitzi/sdk-elements/Element/helpers/elementConstants';
import { intervalOf, MIN_INTERVAL_MS } from '@plitzi/sdk-shared/helpers/interval';
import { parseKeys } from '@plitzi/sdk-shared/helpers/keys';
import { SCROLL_TRIGGER } from '@plitzi/sdk-shared/helpers/scroll';

import { typeTriggerDefinitions } from './catalog';
import { AuthoringError } from '../schema/codes';

import type { StepSpec } from '../schema';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { ScrollStepBehavior, ScrollStepPosition } from '@plitzi/sdk-shared/helpers/scroll';

/**
 * How a flow starts, and how an element changes itself.
 *
 * These are the two halves of a flow that belong to elements rather than to a source module: a trigger fires on
 * the element it is declared on, and an element callback runs against an element by id. Neither takes a source
 * module, and giving one is how a flow ends up wired to nothing.
 *
 * A trigger's `on` is left out on purpose: `authorSpace` fills it with the element the flow was declared on, which
 * is what it is in every case. Naming one is for the rare flow declared in one place and fired from another.
 */

export type ElementTriggerName = keyof typeof interactionBasicTriggers;

/**
 * `on('onClick')`, and the same for every other trigger.
 *
 * The basic set every element registers is named and autocompletes; any other string is accepted because a TYPE
 * may publish triggers of its own — a form's `onSubmit`, a provider's page change — and refusing those would make
 * the builders useless for exactly the flows that matter most.
 */
// Asked rather than indexed: the argument may name no built-in trigger at all — a plugin type is free to publish
// its own — and each record's type says every key is there.
const builtinTrigger = (trigger: string): InteractionCallback | undefined => {
  if (Object.hasOwn(interactionBasicTriggers, trigger)) {
    return interactionBasicTriggers[trigger];
  }

  return Object.hasOwn(typeTriggerDefinitions, trigger) ? typeTriggerDefinitions[trigger] : undefined;
};

export const on = (trigger: ElementTriggerName | (string & {}), params: Record<string, unknown> = {}): StepSpec => {
  const declared = builtinTrigger(trigger);

  return {
    type: 'trigger',
    action: trigger,
    title: declared?.title ?? trigger,
    ...(declared?.preview ? { preview: declared.preview as Record<string, unknown> } : {}),
    params
  };
};

/**
 * A form submitting itself, with the values keyed by each control's `name`.
 *
 * The form's own trigger rather than one of the basic set — and the reason it is worth a builder is what a flow
 * does next: `{{ <this step's id>.values.<name> }}` is how a login step gets the credentials, so this is nearly
 * always a step somebody has to be able to name.
 */
export const onSubmit = (): StepSpec => on('onSubmit');

export const onClick = (params: { propagateEvent?: boolean } = {}): StepSpec => on('onClick', params);

/** The press, before it is a click — where a drag away from the element starts. A click still follows it. */
export const onPointerDown = (params: { propagateEvent?: boolean } = {}): StepSpec => on('onPointerDown', params);

export const onLoad = (): StepSpec => on('onLoad');

/**
 * A keyboard shortcut, heard on the whole page for as long as the element is mounted: `onKey('f')`,
 * `onKey('shift+f')`, `onKey('mod+k')` (⌘ on a Mac, Ctrl elsewhere), several at once with commas (`onKey('plus, =')`).
 *
 * Put it on the element whose flows it drives, or on the page for a shortcut of the page's. A press while somebody
 * types in a field is the field's, unless Ctrl, ⌘ or Alt is held or the key is Escape — and the field keeps its own
 * editing even then (⌘A, ⌘Z, ⌘C/⌘V, moving by word). `{{ <this step's id>.key }}` is the key pressed, canonical (`shift+f`) — for one flow answering several shortcuts.
 */
export const onKey = (keys: string): StepSpec => {
  const { problems } = parseKeys(keys);
  if (problems.length || !keys.trim()) {
    throw new AuthoringError(
      'trigger-keys',
      `onKey('${keys}') is not a shortcut: ${problems.join('; ') || 'it is empty'}. Write one or several, with commas: 'f', 'shift+f', 'mod+k', 'escape, q'.`
    );
  }

  return on('onKey', { keys });
};

/**
 * Every `ms` milliseconds while the element is on the page and the tab is in view — an autoplay, a clock, a refresh:
 * `[[onInterval(5000), setState({ key: 'slide', type: 'number', value: '{{ ((state.slide ?? 0) + 1) % 4 }}' })]]`.
 *
 * At least 250 ms. It does not tick in the builder outside preview. To pause it, put a condition on its steps
 * (`when(...)`) — a state an `onMouseEnter` sets, say. `{{ <this step's id>.count }}` is how many times it has ticked.
 */
export const onInterval = (ms: number): StepSpec => {
  if (intervalOf(ms) === undefined) {
    throw new AuthoringError(
      'trigger-interval',
      `onInterval(${String(ms)}) is not an interval a flow can repeat on: it takes a whole number of milliseconds, at least ${MIN_INTERVAL_MS} — \`onInterval(5000)\` is every five seconds.`
    );
  }

  return on('onInterval', { interval: ms });
};

/**
 * A page has this second load event in addition to {@link onLoad}.
 *
 * `onLoad` runs for every mounted element, including a page. `onPageLoad` belongs only to the page and carries its
 * id plus the current route and query params, so it is the one to use when a flow needs to make a decision from the
 * address that brought the visitor here.
 */
/**
 * The element's own box scrolled; once on mount too. Its flow reads `{ x, y, atStart, atEnd }` — name the trigger
 * and hide the arrow at the end already reached: `[named('row', onScroll()), setState({ key: 'atEnd', type:
 * 'boolean', value: '{{ row.atEnd }}' })]`.
 */
export const onScroll = (): StepSpec => on(SCROLL_TRIGGER);

export const onPageLoad = (): StepSpec => on('onPageLoad');

/**
 * The end of a server action this element started — the trigger a `detached` run needs, because that step returns
 * the moment the server accepts the work and leaves the page with nothing to react to when it finishes.
 */
export const onFlowEnd = (): StepSpec => on('onFlowEnd');

export const onFlowError = (): StepSpec => on('onFlowError');

export const onFlowProgress = (): StepSpec => on('onFlowProgress');

/**
 * Changes one element's own attribute or state — the element `setState`, which is NOT the global one that writes
 * `runtime.state`. Left without a target it runs against the element the flow is declared on.
 *
 * `revertOnFinish` undoes the change when the whole flow ends, which is the correct way to do a temporary one — a
 * "loading…" label, a disabled button — without a second step to put it back.
 */
export const updateElement = (
  params:
    | { category: 'attribute'; key: string; value: unknown; revertOnFinish?: boolean }
    | { category: 'state'; key: string; value: unknown; revertOnFinish?: boolean },
  target?: string
): StepSpec => ({
  type: 'callback',
  action: 'setState',
  title: 'Update Element',
  ...(target === undefined ? {} : { on: target }),
  params
});

/**
 * Empties a form — every value and every error — by id.
 *
 * The step an "add another one" flow needs and nothing else provides: a control's box is driven by the form's own
 * values, so writing the state key behind it leaves the text sitting there. Without this, pressing the button twice
 * adds the same entry twice, which reads as the form having ignored the first press.
 *
 * A form callback, so it runs ON the form — `target` is the form's id, not the button's.
 */
export const resetForm = (target: string): StepSpec => ({
  type: 'callback',
  action: 'performReset',
  title: 'Reset Form',
  on: target,
  params: {}
});

/**
 * Writes one value into a form's control, by the control's `name` — what fills a form with what is already known
 * (the account's username on a profile page) without a binding on the control, which would be rewritten each time its
 * source changed, under the person typing.
 *
 * A form callback, so `target` is the FORM's id. `value` is a template: `'{{ auth.details.username }}'`.
 */
export const setFieldValue = (target: string, name: string, value: string): StepSpec => ({
  type: 'callback',
  action: 'setFieldValue',
  title: 'Set Field Value',
  on: target,
  params: { name, value }
});

/**
 * Asks an `apiContainer` to fetch again, by id.
 *
 * The step every flow that CHANGES what a list is showing needs: a container reads its query once, so a row deleted
 * through a `webHook` is gone from the server and still on the screen — and the page then disagrees with itself until
 * somebody reloads it. Pair it with the call that did the writing rather than with a notification: what tells the
 * person it worked is the row leaving.
 *
 * An element callback, so `target` is the CONTAINER's id, not the button's. `input` is what a server-driven one is
 * asked with this time — `{ q: '{{ state.search }}' }` for a search — beside the page's route and query params, and
 * kept for every page it loads after, until the next reload.
 */
export const reloadApi = (target: string, input?: Record<string, string>): StepSpec => ({
  type: 'callback',
  action: 'performQuery',
  title: 'Reload',
  on: target,
  // What a server-driven provider is asked with this time — a search, a filter — and keeps for the pages after it.
  params: input ? { input } : {}
});

/**
 * Stops an `apiContainer`'s request in flight, by id — a STOP for a slow report: the request is dropped, on the
 * server too, and what the container shows stays. Its `isLoading` turns false.
 *
 * A newer `reloadApi` of the same container already drops the older one, so this is only for the visitor who is done
 * waiting. An element callback, so `target` is the CONTAINER's id.
 */
export const cancelApi = (target: string): StepSpec => ({
  type: 'callback',
  action: 'cancelQuery',
  title: 'Cancel',
  on: target,
  params: {}
});

/**
 * Opens a `modalContainer`, by id.
 *
 * A modal starts OPEN: declare it `visible: false` — its starting state, not a condition — and open it with this.
 * `metadata` travels into the modal, which publishes it as its source, so the content can read what opened it
 * (`{{ modalContainer_<id>.content }}` for a plain value). An element callback, so `target` is the MODAL's id.
 */
export const openModal = (target: string, metadata?: string): StepSpec => ({
  type: 'callback',
  action: 'openModal',
  title: 'Open Modal',
  on: target,
  params: metadata === undefined ? {} : { metadata }
});

/**
 * Says something on a `channel`, by id: every page on its topic hears it — `onMessage`, and the channel's source.
 *
 * `data` is what they receive: a template (`'{{ state.draft }}'`) or JSON text. `type` is yours to name — `chat`,
 * `wave`, `move` — and a flow on `onMessage` tells them apart with `when({ field: '<step>.type', … })`.
 */
export const publishOn = (target: string, type: string, data: unknown = null): StepSpec => ({
  type: 'callback',
  action: 'publish',
  title: 'Publish',
  on: target,
  params: { type, data: typeof data === 'string' ? data : JSON.stringify(data) }
});

/** Announces this page on a `channel` with presence — a name, a colour: what the other members see of it. */
export const announceOn = (target: string, state: unknown): StepSpec => ({
  type: 'callback',
  action: 'setPresence',
  title: 'Set Presence',
  on: target,
  params: { data: typeof state === 'string' ? state : JSON.stringify(state) }
});

/** Closes a `modalContainer`, by id — from a button inside it or anywhere else. */
export const closeModal = (target: string): StepSpec => ({
  type: 'callback',
  action: 'closeModal',
  title: 'Close Modal',
  on: target,
  params: {}
});

/** Opens a `dialogContainer`, by id, the way {@link openModal} opens a modal — it starts open too. */
export const openDialog = (target: string, metadata?: string): StepSpec => ({
  type: 'callback',
  action: 'openDialog',
  title: 'Open Dialog',
  on: target,
  params: metadata === undefined ? {} : { metadata }
});

/** Closes a `dialogContainer`, by id. */
export const closeDialog = (target: string): StepSpec => ({
  type: 'callback',
  action: 'closeDialog',
  title: 'Close Dialog',
  on: target,
  params: {}
});

/**
 * The same write as {@link updateElement}, storing the opposite of what is there — a panel that expands on one click
 * and collapses on the next, from ONE step on ONE trigger.
 *
 * Use it over a state key ({@link toggleState}) when nothing outside this element needs to know whether the panel is
 * open. Anything not already `true` counts as false, so a selector nobody has set yet flips ON first.
 */
export const toggleElement = (
  params: { category: 'attribute' | 'state'; key: string; revertOnFinish?: boolean },
  target?: string
): StepSpec => ({
  type: 'callback',
  action: 'toggleState',
  title: 'Toggle Element',
  ...(target === undefined ? {} : { on: target }),
  params
});

type ScrollMove = { x?: string; y?: string; behavior?: ScrollStepBehavior };

/**
 * Moves what an element's box shows — a row of cards with `overflow: auto`, a panel — by an amount: pixels (`'240'`) or
 * a share of what the box shows (`'80%'`); negative goes back. `target` is the element whose box scrolls.
 *
 * `[onClick(), scrollBy('cards', { x: '80%' })]` is the "next" arrow over a row that still swipes on a phone.
 */
export const scrollBy = (target: string, move: ScrollMove): StepSpec => ({
  type: 'callback',
  action: 'scrollBy',
  title: 'Scroll By',
  on: target,
  params: { ...move }
});

/** Moves an element's box to a place: `'start'`, `'end'`, pixels from the start, or a share of the way (`'50%'`). */
export const scrollTo = (target: string, place: ScrollMove): StepSpec => ({
  type: 'callback',
  action: 'scrollTo',
  title: 'Scroll To',
  on: target,
  params: { ...place }
});

/**
 * Brings an element into view — the page, and every box around it that scrolls. For a link to a part of the page,
 * an `anchor` and a link's `hash` say it without a flow; this is for a flow that has more to do.
 */
export const scrollIntoView = (
  target: string,
  where: { block?: ScrollStepPosition; inline?: ScrollStepPosition; behavior?: ScrollStepBehavior } = {}
): StepSpec => ({
  type: 'callback',
  action: 'scrollIntoView',
  title: 'Scroll Into View',
  on: target,
  params: { ...where }
});

/** What a declaration offers the two builders below: its events and its actions, keyed by name. */
interface DeclaresInteractions {
  triggers?: Readonly<Record<string, InteractionCallback>>;
  callbacks?: Readonly<Record<string, InteractionCallback>>;
}

type TriggerName<D extends DeclaresInteractions> = keyof NonNullable<D['triggers']> & string;

type CallbackName<D extends DeclaresInteractions> = keyof NonNullable<D['callbacks']> & string;

/**
 * A flow's first step, on one of the triggers a declaration says its element fires — typed from the declaration.
 *
 * For an element this SDK does not ship: a plugin fires its own events, and `on('onQuakeSelect')` accepts any string
 * because it cannot know them. Handed the plugin's `declaration.ts`, a trigger it does not declare is a compile error,
 * and the step carries the declared title and `preview` — what the builder shows a reader of the flow.
 */
export const declaredTrigger = <D extends DeclaresInteractions>(declaration: D, trigger: TriggerName<D>): StepSpec => {
  const declared = declaration.triggers?.[trigger];

  return {
    type: 'trigger',
    action: declared?.action ?? trigger,
    title: declared?.title ?? trigger,
    ...(declared?.preview ? { preview: declared.preview as Record<string, unknown> } : {}),
    params: {}
  };
};

/**
 * A step that runs one of the actions a declaration says its element answers to — on the element named by `on`.
 *
 * The built-in elements have a builder per action (`openModal`, `reloadApi`); a plugin's actions are its own, and
 * without this they were written as a literal step, where naming the wrong action, or forgetting `on`, is a button
 * that does nothing. Typed from the declaration, so only an action it declares can be named.
 */
export const declaredCallback = <D extends DeclaresInteractions>(
  declaration: D,
  callback: CallbackName<D>,
  target: { on: string; params?: Record<string, unknown> }
): StepSpec => {
  const declared = declaration.callbacks?.[callback];

  return {
    type: 'callback',
    action: declared?.action ?? callback,
    title: declared?.title ?? callback,
    on: target.on,
    params: target.params ?? {}
  };
};

const carouselStep = (
  target: string,
  action: string,
  title: string,
  params: Record<string, unknown> = {}
): StepSpec => ({
  type: 'callback',
  action,
  title,
  on: target,
  params
});

/** The carousel `target` shows its next slide — round to the first after the last when it loops. */
export const carouselNext = (target: string): StepSpec => carouselStep(target, 'next', 'Next Slide');

/** The carousel `target` shows its previous slide; the slide enters from the left. */
export const carouselPrevious = (target: string): StepSpec => carouselStep(target, 'previous', 'Previous Slide');

/**
 * The carousel `target` shows the slide at `index`, from 0 — a dot's own row: `carouselGoTo('hero', '{{ list_dots.index }}')`.
 */
export const carouselGoTo = (target: string, index: number | string): StepSpec =>
  carouselStep(target, 'goTo', 'Go To Slide', { index: String(index) });

/** The carousel `target` moves on by itself again, every `autoplay` milliseconds. */
export const carouselPlay = (target: string): StepSpec => carouselStep(target, 'play', 'Play');

/** The carousel `target` stops moving by itself until it is told to play. */
export const carouselPause = (target: string): StepSpec => carouselStep(target, 'pause', 'Pause');
