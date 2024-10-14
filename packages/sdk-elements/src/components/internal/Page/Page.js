// Packages
import React, { use, useEffect, useMemo } from 'react';
import classNames from 'classnames';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../Element/RootElement.js';
import withElement from '../../../Element/hocs/withElement.js';
import { PARTIAL_SCHEMA_TYPE_LAYOUT } from '../../../Element/ElementConstants.js';
import ComponentContext from '../../../Component/ComponentContext.js';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   seoEnabled: boolean;
 *   seoPageTitle: string;
 *   seoPageDescription: string;
 *   className: string;
 *   layout: string;
 *   layoutContainer: string;
 *   internalProps: object;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const Page = props => {
  const {
    ref,
    seoEnabled = false,
    seoPageTitle = 'Title',
    seoPageDescription = 'Description',
    className = '',
    layout = '',
    layoutContainer = '',
    internalProps = emptyObject,
    children
  } = props;
  const { id } = internalProps;
  const {
    settings: { previewMode },
    contexts: { NavigationContext, InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const { Helmet, routeParams, queryParams } = use(NavigationContext);
  const { components } = use(ComponentContext);
  const LayoutContainerPlugin = components.layoutContainer;

  const layoutInternalProps = useMemo(
    () => ({
      id: layout,
      rootId: id, // layout to pageId as a root in runtime
      plitziElementLayout: {
        bodyChildren: children,
        containerId: layoutContainer || layout,
        referenceId: id,
        rootId: layoutContainer || layout,
        type: PARTIAL_SCHEMA_TYPE_LAYOUT
      }
    }),
    [layoutContainer, layout, id, children]
  );

  const interactionTriggers = useMemo(
    () => ({
      onPageLoad: {
        title: 'On Page Load',
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
    interactionsManager.interactionTrigger(id, 'onPageLoad', { pageId: id, routeParams, queryParams });
  }, []);

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
      {layout && LayoutContainerPlugin && <LayoutContainerPlugin internalProps={layoutInternalProps} />}
      {!layout && children}
    </RootElement>
  );
};

export default withElement(Page);

export { Page };
