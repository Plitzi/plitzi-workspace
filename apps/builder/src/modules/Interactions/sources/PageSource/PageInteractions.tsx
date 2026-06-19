import { get, pick } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import { StoreContext } from '@plitzi/nexus/StoreContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

import type { StoreApi } from '@plitzi/nexus';
import type { BuilderState, InteractionCallback, InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type PageInteractionsProps = {
  children?: ReactNode;
  previewMode?: boolean;
};

const PageInteractions = ({ children, previewMode = false }: PageInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);
  const { navigate } = use(NavigationContext);
  const store = use(StoreContext) as StoreApi<BuilderState> | undefined;
  const { useStore } = createStoreHook<BuilderState>();
  const [[pageIds, pageDefinitions]] = useStore(['schema.pages', 'pageDefinitions']);

  const handleSetPageState = useCallback(
    (params: InteractionCallbackParamValues<{ key: string; type: string; value: string | boolean | number }>) => {
      const { key, type } = params;
      let { value } = params;
      if (type === 'boolean') {
        value = value === 'true';
      } else if (type === 'number') {
        value = parseInt(value as string, 10);
      }

      store?.setState(`runtime.state.${key}`, value);
    },
    [store]
  );

  const handleClearStatePage = useCallback(() => {
    store?.setState('runtime.state', {});
  }, [store]);

  const pageUrls = useMemo(() => {
    const pages = pick(pageDefinitions, pageIds);

    return Object.keys(pages).reduce<{ key: string; label: string; defaultPage: boolean }[]>((acum, pageId) => {
      const page = pages[pageId];
      const pageName = get(page, 'attributes.name', pageId);
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
      } as InteractionCallback<{ urlType: string; url: string }>,
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
      } satisfies InteractionCallback<{ key: string; type: string; value: string }>,
      clearState: {
        action: 'clearState',
        title: 'Clear Page State',
        type: 'globalCallback',
        callback: handleClearStatePage,
        preview: {},
        params: {}
      }
    }),
    [handleSetPageState, handleClearStatePage, handleNavigate, pageUrls]
  );

  useInteractions({
    id: 'page',
    callbacks: interactionCallbacks as unknown as Record<string, InteractionCallback>
  });

  return children;
};

export default PageInteractions;
