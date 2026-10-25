import type { AuthoringCodeEntry } from './entry';

/** Flows and steps. */
export const FLOW_CODES = {
  'condition-short-source': {
    kind: 'refused',
    means:
      "a step's condition reading an element's source by the element's id alone — `roomStats.locked` — which reads nothing",
    fix: 'the source named in full, as a template names it: `apiContainer_roomStats.locked`'
  },
  'flow-empty': {
    kind: 'refused',
    means: 'a flow with no steps',
    fix: '`[onClick(), setState({ … })]`'
  },
  'flow-without-trigger': {
    kind: 'refused',
    means: 'a flow whose first step is not the event that runs it',
    fix: '`[onClick(), setState(…)]`'
  },
  'step-name': {
    kind: 'refused',
    means: 'a step name a later step cannot read as `{{ name.field }}`',
    fix: 'a letter first, then letters, digits, `-` and `_`'
  },
  'step-duplicate': {
    kind: 'refused',
    means: 'two steps with one name in a flow or an action',
    fix: 'a name each'
  },
  'step-type': {
    kind: 'refused',
    means: 'a step `type` that does not exist',
    fix: 'the step builders — `setState(…)`, `navigate(…)` — write it'
  },
  'step-params': {
    kind: 'refused',
    means: 'a step param that does not exist, or a value outside its options',
    fix: 'the params and values it lists'
  },
  'element-ids-target': {
    kind: 'refused',
    means:
      'a step refreshing containers by id (`invalidateElements`, `invalidateQueries({ elements })`) naming one the space does not have, or one that is not an `apiContainer`',
    fix: "the id of the `apiContainer` whose data the step changes: `invalidateElements: ['posts']`"
  },
  'trigger-never-fired': {
    kind: 'refused',
    means: 'a flow on an event the element never fires',
    fix: "the element that fires it; for a plugin, `declaredTrigger(declaration, 'onPick')`"
  },
  'trigger-keys': {
    kind: 'refused',
    means: 'an `onKey` shortcut that cannot fire: two keys at once, only modifiers, or a name that is not a key',
    fix: "`onKey('f')`, `onKey('shift+f')`, `onKey('mod+k, escape')`"
  },
  'trigger-interval': {
    kind: 'refused',
    means: 'an `onInterval` that never ticks: not a whole number of milliseconds, or below 250',
    fix: '`onInterval(5000)`'
  },
  'while-running': {
    kind: 'refused',
    means:
      '`whileRunning` on a step that is not the trigger, or a mode other than `skip`, `parallel`, `queue`, `latest`',
    fix: "`[whileRunning('queue', onClick()), …]`"
  },
  'callback-not-answered': {
    kind: 'refused',
    means: 'a step sending an action the target element never answers to',
    fix: "the element that answers it; for a plugin, `declaredCallback(declaration, 'reset', { on })`"
  },
  'callback-key-unknown': {
    kind: 'refused',
    means: 'a `setState` / `toggleState` on an element writing a field it does not have',
    fix: "an attribute it lists, or for `category: 'state'` `visibility` / `styleSelectors.<selector>`"
  },
  'global-callback-undeclared': {
    kind: 'refused',
    means: 'a global-callback step builder naming an action no source declares',
    fix: 'one of the actions it lists'
  },
  'global-callback-module': {
    kind: 'refused',
    means: 'a global callback sent to a module other than the one that registers it',
    fix: 'the step builder, which knows the module'
  },
  'message-while-running': {
    kind: 'warned',
    means:
      "a channel's `onMessage` flow with no `whileRunning`: a message that arrives while it runs is dropped (`skip`, the default)",
    fix: "`[whileRunning('queue', onMessage()), …]` to hear each one, `'latest'` for the last; `whileRunning('skip', …)` when dropping is meant"
  },
  'unknown-global-callback': {
    kind: 'warned',
    means: 'a global callback no built-in source declares — it runs only if something registers it',
    fix: 'the built-in it suggests, or make sure a plugin or module of the space registers it'
  },
  'utility-module': {
    kind: 'refused',
    means: 'a utility sent to a module — a utility takes none',
    fix: 'drop the `on`'
  },
  'unknown-utility': {
    kind: 'warned',
    means: 'a utility that is not one of the built-in ones',
    fix: 'one of the built-in utilities'
  },
  'state-key-has-runtime-prefix': {
    kind: 'warned',
    means: 'a state key written with `runtime.state.` in front — the state callbacks already write below it',
    fix: "`key: 'cart'`, not `'runtime.state.cart'`"
  },
  'state-toggled-in-branches': {
    kind: 'warned',
    means: 'two `setState` of one key, each under a `when` on that key — the second flips back what the first wrote',
    fix: '`toggleState({ key })`; for something shown by default, a key named for hiding it'
  },
  'form-value-compared-to-blank': {
    kind: 'warned',
    means: 'a `when` comparing a submitted field to `""` — a field nobody typed in is not sent',
    fix: "`operator: 'empty'` / `'notEmpty'`"
  },
  'condition-field-unpublished': {
    kind: 'refused',
    means:
      'a `when` asking a step of its flow for a key it never publishes — `whenSucceeded` / `whenFailed` on anything but `runServerAction`',
    fix: "a key the step publishes (`explain <step>`): after `authLogin`, `when({ field: 'signedIn.ok', operator: '=', value: true }, …)`"
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
