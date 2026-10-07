/* eslint-disable quotes -- the entries quote code, which reads best in the other quotes */
import { MOTION_ENTERS, MOTION_LOOPS, MOTION_TRIGGERS } from '@plitzi/sdk-shared/schema/motion';

/**
 * The authoring functions that are not an element, a step or a trigger — what wires an element to its data, its state
 * and its neighbours — said the way `explain` says the rest: what it is for, how it is written, an example. Each name is
 * an export of the package, which `explain.test.ts` holds this list to; `motion`, an element's field, is said from the
 * presets the SDK plays.
 */
export interface HelperEntry {
  /** How it is written. */
  signature: string;
  /** What it is for, in a sentence. */
  summary: string;
  example: string;
}

export const AUTHORING_HELPERS: Readonly<Record<string, HelperEntry>> = {
  bindTemplate: {
    signature: "bindTemplate(to, source, template, { returns?: 'text' | 'value', category? })",
    summary:
      'An attribute computed by a template over a source: a label with units, a URL with an id, a filtered list.',
    example: "text('', { bind: [bindTemplate('content', 'state.xp', '{{ source }} XP')] })"
  },
  visibleWhen: {
    signature: 'visibleWhen(source, template?)',
    summary: 'Shows or hides an element from a value — the visibility binding, whose category nobody guesses.',
    example: "container({ bind: [visibleWhen('state.menuOpen')] })   // or visible: 'state.menuOpen'"
  },
  variantFrom: {
    signature: 'variantFrom(class, source, { template? })',
    summary: "Switches one of a class's variants from a value: a status pill that turns amber, green or red.",
    example: "text({ class: pill, bind: [variantFrom(pill, 'list_jobs.item.status')] })"
  },
  activeOn: {
    signature: 'activeOn(class, pageIds)',
    summary:
      "Marks a navigation entry as current on the pages it stands for, through the class's `active` variant — for " +
      "pages not under its path; a link lit on the pages under it is `current: 'section'`.",
    example: "link({ href: 'docs', class: navLink, bind: [activeOn(navLink, 'docs')] })"
  },
  activeWhen: {
    signature: 'activeWhen(class, condition)',
    summary: "Wears a class's `active` variant while a condition holds: the dot of the slide on screen, the open tab.",
    example: "container({ class: dot, bind: [activeWhen(dot, '{{ list_dots.index == state.slide }}')] })"
  },
  when: {
    signature: "when(rules, step, combinator = 'and')",
    summary:
      'Runs a step only when a rule holds — what is conditional in a flow is said on its steps, not by branching.',
    example: "when({ field: 'saved.ok', operator: '=', value: true }, navigate({ to: 'thanks' }))"
  },
  whileRunning: {
    signature: "whileRunning('skip' | 'queue' | 'parallel' | 'latest', trigger)",
    summary:
      'What a trigger does when it fires again while its flow still runs: ignore it (the default), queue it, run both, ' +
      'or stop the running one and run the new — `latest`, for a search as you type.',
    example: "[whileRunning('latest', named('typed', on('onChange'))), runServerAction({ … })]"
  },
  named: {
    signature: 'named(id, step)',
    summary: 'Names a step, so a later one reads what it produced: `{{ <id>.field }}`.',
    example: "[named('sent', onSubmit()), setState({ key: 'email', type: 'text', value: '{{ sent.values.email }}' })]"
  },
  scope: {
    signature: 'scope(prefix, ref => …)',
    summary: 'Builds a part whose ids are its own — every id inside is prefixed — so a helper called twice writes two.',
    example: "scope('promos', ref => container({ id: 'panel', children: [list({ id: 'slides' })] }))   // promos-panel"
  },
  source: {
    signature: 'source(id, sample)',
    summary: "An `apiContainer`'s source typed by a sample of its answer: a path the sample lacks is a type error.",
    example: "const site = source('site', home); heading({ from: site.data.hero.title })"
  },
  twig: {
    signature: 'twig`…`',
    summary: 'A template whose paths are typed source paths, each written as its full name.',
    example: 'text(twig`{{ ${site.data.total} + 1 }}`)'
  }
};

/** `motion`, an element's field: what it takes, from the presets the SDK plays. */
export const MOTION_ENTRY: HelperEntry = {
  signature: `motion: { enter?: ${MOTION_ENTERS.map(name => `'${name}'`).join(' | ')}; on?: ${MOTION_TRIGGERS.map(name => `'${name}'`).join(' | ')}; duration?; delay?; stagger?; loop?: ${MOTION_LOOPS.map(name => `'${name}'`).join(' | ')} }`,
  summary:
    "How an element arrives and whether it keeps moving, played by the SDK's stylesheet and stilled for reduced motion. `on: 'view'` plays once as it comes into view; `on: 'scroll'` follows the scroll both ways.",
  example: "container({ motion: { enter: 'fade-up', on: 'view', stagger: 60 }, children })"
};
