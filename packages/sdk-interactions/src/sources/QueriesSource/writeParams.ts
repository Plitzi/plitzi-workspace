import type { ParamSpec } from '@plitzi/sdk-shared/authoring/paramSpec';
import type { WriteInvalidation } from '@plitzi/sdk-shared/queries';

const LABELS: Record<WriteInvalidation, string> = {
  origin: 'Requests to the same site',
  all: 'All cached requests',
  elements: 'Only these containers',
  none: 'None — this only reads'
};

/**
 * The two params a step that writes carries: what to refresh once it succeeded, and — when it is a list — which
 * containers, by id. Declared once for every such step, so a webhook and a server action offer the same choice.
 *
 * @param modes What this step can offer, its default first. `origin` needs a URL the step knows.
 * @param applies When the step writes at all; a webhook that only reads shows neither param.
 */
export const writeInvalidationParams = (
  modes: readonly WriteInvalidation[],
  applies: (params: Record<string, unknown>) => boolean = () => true
): ParamSpec => ({
  invalidateQueries: {
    type: 'select',
    description:
      'What to refresh once the write succeeded, so the page shows the new data: the cached requests to the same ' +
      'site, all of them, only the api containers named in `invalidateElements`, or none for a step that only reads. ' +
      'Containers on screen ask again at once; the rest when they are shown.',
    default: modes[0],
    options: [...modes],
    optionLabels: Object.fromEntries(modes.map(mode => [mode, LABELS[mode]])),
    label: 'Refresh cached requests',
    canBind: false,
    when: applies
  },
  invalidateElements: {
    type: 'text',
    description: 'The api containers to refresh, by element id, separated by commas.',
    default: '',
    label: 'Containers (ids)',
    when: params => applies(params) && params.invalidateQueries === 'elements'
  }
});
