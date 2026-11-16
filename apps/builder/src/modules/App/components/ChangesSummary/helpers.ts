import type { SpaceVersionChanges } from '@plitzi/sdk-shared';

const plural = (count: number, one: string, many = `${one}s`): string => `${String(count)} ${count === 1 ? one : many}`;

/**
 * What changes, in a line a person reads at a glance — the pages first, by what happened to them, then each other part
 * that differs — and the names behind it, for whoever opens the list.
 */
export const changeLines = (changes: SpaceVersionChanges): { summary: string; details: string[] } => {
  if (changes.total === 0) {
    return { summary: 'Nothing changes', details: [] };
  }

  const { pages, plugins } = changes;
  const parts = [
    pages.changed.length > 0 ? `${plural(pages.changed.length, 'page')} changed` : '',
    pages.added.length > 0 ? plural(pages.added.length, 'new page') : '',
    pages.removed.length > 0 ? `${plural(pages.removed.length, 'page')} removed` : '',
    changes.layouts > 0 ? plural(changes.layouts, 'layout') : '',
    changes.components > 0 ? plural(changes.components, 'component') : '',
    changes.styles ? 'styles' : '',
    changes.fonts ? 'fonts' : '',
    changes.settings ? 'settings' : '',
    plugins.added.length + plugins.removed.length + plugins.changed.length > 0
      ? plural(plugins.added.length + plugins.removed.length + plugins.changed.length, 'plugin')
      : '',
    changes.actions > 0 ? plural(changes.actions, 'action') : '',
    changes.connectors > 0 ? plural(changes.connectors, 'connector') : '',
    changes.functions ? 'functions' : '',
    changes.runtime ? 'runtime' : ''
  ].filter(Boolean);
  const named = (label: string, names: string[]) => (names.length > 0 ? [`${label}: ${names.join(', ')}`] : []);

  return {
    summary: parts.join(' · '),
    details: [
      ...named('Changed', pages.changed),
      ...named('New', pages.added),
      ...named('Removed', pages.removed),
      ...named('Plugins added', plugins.added),
      ...named('Plugins removed', plugins.removed),
      ...named('Plugins updated', plugins.changed)
    ]
  };
};
