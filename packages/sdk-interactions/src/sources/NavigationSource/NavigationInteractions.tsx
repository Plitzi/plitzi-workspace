import { get, pick } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo } from 'react';

import { toBuilderParams, toInteractionCallbacks } from '@plitzi/sdk-shared/authoring';
import { useSdkStore } from '@plitzi/sdk-shared/store';

import { navigationCallbacks } from './callbacks';
import { navigateHow } from './navigateHow';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionCallbackParam } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type NavigationInteractionsProps = {
  children?: ReactNode;
  previewMode?: boolean;
};

const NavigationInteractions = ({ children, previewMode = false }: NavigationInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);
  const [[pageIds, pageDefinitions, navigate]] = useSdkStore([
    'schema.pages',
    'pageDefinitions',
    'navigation.navigate'
  ]);

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
    (params: { url: string; urlType: 'internal' | 'external' | 'page'; replace?: boolean }) => {
      if (!previewMode) {
        return;
      }

      navigate(params.url, navigateHow(params));
    },
    [navigate, previewMode]
  );

  const interactionCallbacks = useMemo(() => {
    const { urlType, url, replace } = toBuilderParams(navigationCallbacks.navigate.params);

    return toInteractionCallbacks(
      navigationCallbacks,
      { navigate: handleNavigate },
      {
        navigate: {
          // The pages of the space being edited: a fact about this document rather than about navigating, so the
          // declaration says the control is a picker and the editor says what is in it.
          params: {
            urlType,
            replace,
            url: {
              ...url,
              defaultValue: pageUrls.find(page => page.defaultPage)?.key ?? '',
              options: pageUrls.map(page => ({ value: page.key, label: page.label }))
            } as InteractionCallbackParam
          }
        }
      }
    );
  }, [handleNavigate, pageUrls]);

  useInteractions({ id: 'navigation', callbacks: interactionCallbacks });

  return children;
};

export default NavigationInteractions;
