import type { SpaceVersionContents } from '@plitzi/sdk-shared';

/** One line of what a version holds: what it is, and how much of it. */
export type ContentsRow = { label: string; value: string };

const counted = (count: number, one: string, many = `${one}s`): string =>
  `${String(count)} ${count === 1 ? one : many}`;

const runtimeValue = (runtime: SpaceVersionContents['runtime']): string => {
  if (!runtime) {
    return 'None';
  }

  return runtime.source ? 'Its code, with the source it was packed from' : 'Its code, built only';
};

/** What a version holds, as the lines the builder shows — the plugins are listed on their own, by name. */
export const contentsRows = (contents: SpaceVersionContents): ContentsRow[] => [
  {
    label: 'Pages',
    value: `${counted(contents.pages, 'page')} · ${counted(contents.layouts, 'layout')} · ${counted(contents.components, 'component')} · ${counted(contents.elements, 'element')}`
  },
  { label: 'Server actions', value: contents.actions > 0 ? counted(contents.actions, 'action') : 'None' },
  { label: 'Connectors', value: contents.connectors > 0 ? counted(contents.connectors, 'connector') : 'None' },
  {
    label: 'Functions',
    value: contents.functions
      ? `${counted(contents.functions.tasks, 'task')} · ${counted(contents.functions.routes, 'route')}`
      : 'None'
  },
  { label: 'Runtime', value: runtimeValue(contents.runtime) }
];
