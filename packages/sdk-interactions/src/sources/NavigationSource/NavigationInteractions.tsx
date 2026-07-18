import { get, pick } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import InteractionsContext from '../../InteractionsContext';

import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type NavigationInteractionsProps = {
  children?: ReactNode;
  previewMode?: boolean;
};

const NavigationInteractions = ({ children, previewMode = false }: NavigationInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);
  const { navigate } = use(NavigationContext);
  const [[pageIds, pageDefinitions]] = useCommonStore(['schema.pages', 'pageDefinitions']);

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
        action: 'navigate',
        title: 'Navigate',
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
      } as InteractionCallback<{ urlType: string; url: string }>
    }),
    [handleNavigate, pageUrls]
  );

  useInteractions({ id: 'navigation', callbacks: interactionCallbacks });

  return children;
};

export default NavigationInteractions;
