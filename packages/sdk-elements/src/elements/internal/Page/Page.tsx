/* eslint-disable react-refresh/only-export-components */
import { Helmet } from '@dr.pogodin/react-helmet';
import clsx from 'clsx';
import { use, useEffect, useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { useSdkStore } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';
import LayoutContainer from '../LayoutContainer';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type PageProps = {
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
  ref,
  seoEnabled = false,
  seoPageTitle = 'Title',
  seoPageDescription = 'Description',
  className = '',
  layout = '',
  layoutContainer = '',
  children
}: PageProps) => {
  const { id } = useElement();
  const {
    settings: { previewMode },
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const [[routeParams, queryParams]] = useSdkStore(['navigation.routeParams', 'navigation.queryParams']);

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

  /**
   * Announced once the commit that mounted this page has finished, not in the middle of it.
   *
   * The global sources — `actions`, `state`, the rest — register what they can do from effects of their own, and
   * they sit ABOVE the page: React runs a parent's effect after its children's, so a page firing this synchronously
   * announces itself to a manager that has not been told `actions.runServerAction` exists yet. The flow then ran,
   * found nothing registered and did nothing, on the first load only — which is the load an `onPageLoad` flow is
   * written for. A microtask lands after the whole effect flush, and on a navigation nothing has changed for it.
   */
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      void interactionsManager.interactionTrigger(id, 'onPageLoad', { pageId: id, routeParams, queryParams });
    });

    return () => {
      cancelled = true;
    };
  }, [id, interactionsManager, queryParams, routeParams]);

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__page', className)}
      interactionTriggers={interactionTriggers}
    >
      {seoEnabled && previewMode && (
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
