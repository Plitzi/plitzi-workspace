import get from 'lodash-es/get';
import pick from 'lodash-es/pick';
import { useCallback, use, useMemo } from 'react';

import SchemaPagesContext from '@modules/Schema/SchemaPagesContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';

import type { InteractionBaseCallback, InteractionCallbackParamValues, Schema } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type PageInteractionsProps = {
  children: ReactNode;
  previewMode?: boolean;
};

const PageInteractions = ({ children, previewMode = true }: PageInteractionsProps) => {
  const { schema } = use(SchemaContext);
  const { keepState, stateStorage } = useMemo<Schema['settings']>(
    () => get(schema, 'settings', {} as Schema['settings']),
    [schema]
  );
  const { setStateByKey, clearCache } = use(StateManagerContext);
  const { useInteractions } = use(InteractionsContext);
  const { navigate } = use(NavigationContext);
  const { pages: pageIds, pageDefinitions } = use(SchemaPagesContext);

  const handleSetPageState = useCallback(
    (params: InteractionCallbackParamValues<{ key: string; type: string; value: string | boolean | number }>) => {
      const { key, type } = params;
      let { value } = params;
      if (type === 'boolean') {
        value = value === 'true';
      } else if (type === 'number') {
        value = parseInt(value as string, 10);
      }

      if (keepState && stateStorage) {
        setStateByKey(key, value, stateStorage);

        return;
      }

      setStateByKey(key, value);
    },
    [setStateByKey, keepState, stateStorage]
  );

  const handleClearStatePage = useCallback(() => {
    if (keepState && stateStorage) {
      clearCache(stateStorage);
    }
  }, [clearCache, stateStorage, keepState]);

  const pageUrls = useMemo(() => {
    const pages = pick(pageDefinitions, pageIds);

    return Object.keys(pages).reduce<{ key: string; label: string; defaultPage: boolean }[]>((acum, pageId) => {
      const page = pages[pageId];
      const pageName = get(page, 'attributes.name', pageId) as string;
      const defaultPage = get(page, 'attributes.default', false) as boolean;

      return [...acum, { key: pageId, label: pageName, defaultPage }];
    }, []);
  }, [pageDefinitions, pageIds]);

  const handleNavigate = useCallback(
    (params: { url: string; urlType: 'internal' | 'external' | 'page' }) => {
      if (!previewMode) {
        return;
      }

      const { url, urlType } = params;
      if (urlType === 'page' || urlType === 'internal') {
        navigate(url);
      } else {
        // external url
        navigate(url, true);
      }
    },
    [navigate, previewMode]
  );

  const interactionCallbacks = useMemo(
    () => ({
      navigate: {
        action: 'navigateToPage',
        title: 'Navigate To Page',
        type: 'globalCallback',
        callback: handleNavigate,
        preview: {},
        params: {
          urlType: {
            label: 'Url Type',
            defaultValue: undefined,
            type: 'select',
            options: [
              { value: 'page', label: 'Space Page' },
              { value: 'internal', label: 'Inside Space' },
              { value: 'external', label: 'Outside Space' }
            ]
          },
          url: {
            defaultValue: pageUrls.find(page => page.defaultPage)?.key ?? '',
            type: params => (params.urlType === 'page' ? 'select' : 'text'),
            when: params => !!params.urlType,
            options: pageUrls.map(page => ({ value: page.key, label: page.label }))
          }
        }
      } as InteractionBaseCallback<{ urlType: string; url: string }>,
      setPageState: {
        action: 'setPageState',
        title: 'Set Page State',
        type: 'globalCallback',
        callback: handleSetPageState,
        preview: {},
        params: {
          key: { defaultValue: '', type: 'text' },
          type: {
            defaultValue: undefined,
            type: 'select',
            options: [
              { value: 'boolean', label: 'True / False' },
              { value: 'number', label: 'Numeric' },
              { value: 'text', label: 'Text' }
            ]
          },
          value: {
            defaultValue: undefined,
            type: params => (params.type === 'boolean' ? 'select' : 'text'),
            when: params => !!params.type,
            options: [
              { value: 'true', label: 'True' },
              { value: 'false', label: 'False' }
            ]
          }
        }
      } as InteractionBaseCallback<{ key: string; type: string; value: string }>,
      clearState: {
        action: 'clearState',
        title: 'Clear Page State',
        type: 'globalCallback',
        callback: handleClearStatePage,
        preview: {},
        params: {}
      } as InteractionBaseCallback
    }),
    [handleSetPageState, handleClearStatePage, handleNavigate, pageUrls]
  );

  useInteractions({
    id: 'page',
    callbacks: interactionCallbacks as unknown as Record<string, InteractionBaseCallback>
  });

  return children;
};

export default PageInteractions;
