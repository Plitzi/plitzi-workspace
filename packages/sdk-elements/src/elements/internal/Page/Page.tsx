/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { use, useEffect, useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';
import LayoutContainer from '../LayoutContainer';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type PageProps = {
  id: string;
  ref?: RefObject<HTMLElement>;
  seoEnabled?: boolean;
  seoPageTitle?: string;
  seoPageDescription?: string;
  className?: string;
  layout?: string;
  layoutContainer?: string;
  children?: ReactNode;
};

const Page = ({
  id,
  ref,
  seoEnabled = false,
  seoPageTitle = 'Title',
  seoPageDescription = 'Description',
  className = '',
  layout = '',
  layoutContainer = '',
  children
}: PageProps) => {
  const {
    settings: { previewMode },
    contexts: { NavigationContext, InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const { Helmet, routeParams, queryParams } = use(NavigationContext);

  const layoutInternalProps = useMemo(
    () => ({
      id: layout,
      rootId: id, // layout to pageId as a root in runtime
      plitziElementLayout: {
        bodyChildren: children,
        containerId: layoutContainer || layout,
        referenceId: id,
        rootId: layoutContainer || layout,
        type: 'layout' as const
      }
    }),
    [layoutContainer, layout, id, children]
  );

  const interactionTriggers = useMemo<Record<string, InteractionCallback>>(
    () => ({
      onPageLoad: {
        action: 'onPageLoad',
        title: 'On Page Load',
        type: 'trigger',
        params: {
          // pageId: { canBind: false, defaultValue: '', type: 'text', label: 'Page ID' },
          // routeParams: { canBind: false, defaultValue: '', type: 'text', label: 'Route Params' },
          // queryParams: { canBind: false, defaultValue: '', type: 'text', label: 'Query params' }
        },
        preview: { pageId: '', routeParams: '', queryParams: '' }
      }
    }),
    []
  );

  useEffect(() => {
    void interactionsManager.interactionTrigger(id, 'onPageLoad', { pageId: id, routeParams, queryParams });
  }, [id, interactionsManager, queryParams, routeParams]);

  return (
    <RootElement
      id={id}
      ref={ref}
      className={clsx('plitzi-component__page', className)}
      interactionTriggers={interactionTriggers}
    >
      {seoEnabled && previewMode && Helmet && (
        <Helmet>
          {!!seoPageTitle && <title>{seoPageTitle}</title>}
          {!!seoPageDescription && <meta name="description" content={seoPageDescription} />}
        </Helmet>
      )}
      {layout && <LayoutContainer internalProps={layoutInternalProps} />}
      {!layout && children}
    </RootElement>
  );
};

export default withElement(Page);

export { Page };
