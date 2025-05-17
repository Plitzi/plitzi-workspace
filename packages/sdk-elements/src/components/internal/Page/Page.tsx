/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { use, useEffect, useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import ComponentContext from '../../../Component/ComponentContext';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { NavigationContextValue } from '@plitzi/sdk-navigation';
import type { InteractionBaseCallback, InternalPropsSTG1, InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type PageProps = {
  ref?: RefObject<HTMLElement>;
  seoEnabled?: boolean;
  seoPageTitle?: string;
  seoPageDescription?: string;
  className?: string;
  layout?: string;
  layoutContainer?: string;
  internalProps: InternalPropsSTG2;
  children?: ReactNode;
};

const Page = ({
  ref,
  seoEnabled = false,
  seoPageTitle = 'Title',
  seoPageDescription = 'Description',
  className = '',
  layout = '',
  layoutContainer = '',
  internalProps,
  children
}: PageProps) => {
  const { id } = internalProps;
  const {
    settings: { previewMode },
    contexts: { NavigationContext, InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext) as InteractionsContextValue;
  const { Helmet, routeParams, queryParams } = use(NavigationContext) as NavigationContextValue;
  const { components } = use(ComponentContext);
  const LayoutContainerPlugin = components.layoutContainer;

  const layoutInternalProps = useMemo<InternalPropsSTG1>(
    () => ({
      id: layout,
      rootId: id, // layout to pageId as a root in runtime
      plitziElementLayout: {
        bodyChildren: children,
        containerId: layoutContainer || layout,
        referenceId: id,
        rootId: layoutContainer || layout,
        type: 'layout'
      }
    }),
    [layoutContainer, layout, id, children]
  );

  const interactionTriggers = useMemo<Record<string, InteractionBaseCallback>>(
    () => ({
      onPageLoad: {
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
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__page', className)}
      interactionTriggers={interactionTriggers}
    >
      {seoEnabled && previewMode && Helmet && (
        <Helmet>
          {seoPageTitle && <title>{seoPageTitle}</title>}
          {seoPageDescription && <meta name="description" content={seoPageDescription} />}
        </Helmet>
      )}
      {layout && <LayoutContainerPlugin internalProps={layoutInternalProps} />}
      {!layout && children}
    </RootElement>
  );
};

export default withElement(Page);

export { Page };
