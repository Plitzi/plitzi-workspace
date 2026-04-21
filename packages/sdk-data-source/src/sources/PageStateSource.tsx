import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import { createStoreHook } from '@plitzi/sdk-shared/store';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';

import type { BuilderState, SourceField } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type PageStateSourceProps = {
  children?: ReactNode;
};

const PageStateSource = ({ children }: PageStateSourceProps) => {
  const { useDataSource } = use(DataSourceContext);
  const { currentPageId } = use(NavigationContext);
  const { useStore } = createStoreHook<BuilderState>();
  const [pageDefinitions] = useStore('pageDefinitions', { defaultValue: {} });
  const { state } = use(StateManagerContext);
  const pages = useMemo(
    () =>
      Object.values(pageDefinitions).reduce<{ value: string; label: string }[]>(
        (acum, page) => [...acum, { value: page.id, label: get(page, 'attributes.name', page.id) }],
        []
      ),
    [pageDefinitions]
  );

  const sourceFields = useCallback(() => {
    if (pages.length > 0) {
      return [
        ...getPathsFromObeject(state).reduce<SourceField[]>(
          (acum, path) => [...acum, { path, name: `page.${path}` }],
          []
        ),
        { path: 'currentPageId', name: 'Current Page', inputType: 'select', values: pages } as SourceField
      ];
    }

    return [
      ...getPathsFromObeject(state).reduce<SourceField[]>(
        (acum, path) => [...acum, { path, name: `page.${path}` }],
        []
      ),
      { path: 'currentPageId', name: 'Current Page' }
    ];
  }, [state, pages]);

  const finalState = useMemo(() => ({ ...state, currentPageId }), [state, currentPageId]);

  const [PageStateContext] = useDataSource({
    id: 'global',
    source: 'page',
    name: 'Page',
    mode: 'write',
    fields: sourceFields
  });

  return <PageStateContext value={finalState}>{children}</PageStateContext>;
};

export default PageStateSource;
