// Packages
import React, { forwardRef, useContext, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';
import { PARTIAL_SCHEMA_TYPE_LAYOUT } from '@modules/Element/ElementConstants';

// Relatives
import ComponentContext from '../../../modules/Component/ComponentContext';
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';
import { emptyObject } from '../../../helpers/utils';

const Page = forwardRef((props, ref) => {
  const {
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
  const { interactionTrigger } = useContext(InteractionsContext);
  const { Helmet, routeParams, queryParams } = useContext(NavigationContext);
  const { components } = useContext(ComponentContext);
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
    interactionTrigger(id, 'onPageLoad', { pageId: id, routeParams, queryParams });
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
});

Page.propTypes = {
  internalProps: PropTypes.object,
  children: PropTypes.node,
  className: PropTypes.string,
  enabled: PropTypes.bool,
  name: PropTypes.string,
  slug: PropTypes.string,
  folder: PropTypes.string,
  layout: PropTypes.string,
  layoutContainer: PropTypes.string,
  seoEnabled: PropTypes.bool,
  seoPageTitle: PropTypes.string,
  seoPageDescription: PropTypes.string
};

export default withElement(Page);

export { Page };
