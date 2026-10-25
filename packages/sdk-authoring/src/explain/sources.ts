import { GLOBAL_SOURCE_FIELDS } from '@plitzi/sdk-shared/dataSource';

import type { GlobalSource } from '@plitzi/sdk-shared/dataSource';

/**
 * What each global source a template reads is — `navigation`, `host`, `theme`… — for `plitzi explain` and `--list
 * sources`: one entry for every global there is, the type holding the two together, so a new global is explained the day
 * it is added. A run's developer asked `explain host` and `explain theme` and was told they were nothing.
 */
export interface SourceDoc {
  summary: string;
  example: string;
}

export const SOURCE_DOCS: Record<GlobalSource, SourceDoc> = {
  variables: {
    summary: "The space's variables: its colours, sizes and words, as the space declares them",
    example: '{{ variables.color.primary }}'
  },
  navigation: {
    summary: 'Where the visitor is: the route and query params, the page, its address, a move under way',
    example: '{{ navigation.routeParams.slug }}'
  },
  auth: {
    summary: 'Who is signed in: whether anyone is, the session state, the account’s details',
    example: "{{ auth.isAuthenticated ? 'Hola, ' ~ auth.details.name : 'Entrar' }}"
  },
  state: {
    summary: 'What the page keeps as the visitor uses it — written by flows (setState), read by anything',
    example: '{{ state.filtersOpen }}'
  },
  host: {
    summary: 'What an application embedding the space hands it (its hostData): anything it chooses',
    example: '{{ host.user.locale }}'
  },
  theme: {
    summary: 'The colour scheme: the one chosen (light, dark or the system’s) and the one painted',
    example: "{{ theme.resolved == 'dark' }}"
  },
  flags: {
    summary: "The space's feature flags, on or off for this visitor",
    example: '{{ flags.newCheckout }}'
  },
  computed: {
    summary: 'Values the space computes once over the others and every binding reads by name',
    example: '{{ computed.cartTotal }}'
  }
};

/** The fields the platform decides of a global, when it decides them: what a read of another name finds nothing in. */
export const sourceFields = (name: GlobalSource): string[] =>
  Object.hasOwn(GLOBAL_SOURCE_FIELDS, name)
    ? Object.keys(GLOBAL_SOURCE_FIELDS[name as keyof typeof GLOBAL_SOURCE_FIELDS])
    : [];
