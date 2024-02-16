// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import { ComponentContext, PlitziServiceProvider } from '@plitzi/plitzi-sdk';
import ContainerShadow from '@plitzi/plitzi-ui-components/ContainerShadow';
import ContainerRootContext from '@plitzi/plitzi-ui-components/ContainerRoot/ContainerRootContext';
import ErrorBoundary from '@plitzi/plitzi-ui-components/ErrorBoundary';

// Monorepo
import DataSourceContext from '@repo/data-source-shared/DataSourceContext';

// Alias
import PluginsContext from '@pmodules/Plugins/PluginsContext';
import NavigationContext from '@pmodules/Navigation/NavigationContext';
import CollectionContext from '@pmodules/Collection/CollectionContext';
import NetworkContext from '@pmodules/Network/NetworkContext';
import AppContext from '@pmodules/App/AppContext';
import SchemaContext from '@pmodules/Schema/SchemaContext';
import StateManagerContext from '@pmodules/StateManager/StateManagerContext';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';
import StyleContext from '@pmodules/Style/StyleContext';

// Relatives
import BuilderContext from '../../BuilderContext';
import BuilderStyleContext from '../../contexts/BuilderStyleContext';
import BuilderSchemaContext from '../../contexts/BuilderSchemaContext';
import { defaultElementsSettings } from '../../../../SdkComponents';
import { emptyObject } from '../../../../helpers/utils';

const ElementSettings = props => {
  const { id = '', type = '', attributes = emptyObject, handleChange = noop } = props;
  const { previewMode, displayBorderComponents } = useContext(AppContext);
  const { getComponent } = useContext(ComponentContext);
  const Plugin = getComponent(type);
  const { pluginStyles } = useContext(PluginsContext);
  const { currentPageId } = useContext(NavigationContext);
  const {
    baseContext: { baseElementId }
  } = useContext(BuilderContext);
  const { rootDOM } = useContext(ContainerRootContext);

  const { schema } = useContext(BuilderSchemaContext);
  const { style } = useContext(BuilderStyleContext);

  const getWindow = useCallback(() => {
    // if (ref.current) {
    //   return ref.current.contentWindow;
    // }

    return window;
  }, []); // ref

  const plitziContextValue = useMemo(
    () => ({
      settings: {
        previewMode,
        currentPageId
      },
      root: {
        baseElementId
      },
      utils: {
        displayBorderComponents,
        getWindow,
        rootDOM
      },
      customContexts: {},
      contexts: {
        ComponentContext,
        ContainerRootContext,
        CollectionContext,
        NetworkContext,
        PluginsContext,
        NavigationContext,
        DataSourceContext,
        SchemaContext,
        StateManagerContext,
        SegmentsContext
      }
    }),
    [
      PluginsContext,
      DataSourceContext,
      currentPageId,
      previewMode,
      baseElementId,
      ComponentContext,
      getWindow,
      displayBorderComponents,
      CollectionContext,
      NavigationContext,
      NetworkContext,
      StateManagerContext,
      SchemaContext,
      SegmentsContext
    ]
  );

  const schemaValueMemo = useMemo(() => ({ schema }), [schema]);
  const styleValueMemo = useMemo(() => ({ style }), [style]);

  if (Plugin && pluginStyles[type] && pluginStyles[type].length > 0) {
    return (
      <ContainerShadow
        className="flex flex-col h-full"
        fallback={
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <link
              rel="stylesheet"
              href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
              integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA=="
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
            <i className="fa-solid fa-sync fa-spin fa-3x" />
          </div>
        }
      >
        {pluginStyles[type].map((style, i) => (
          <ContainerShadow.Link key={i} href={style} />
        ))}
        <ContainerShadow.Content>
          <PlitziServiceProvider value={plitziContextValue}>
            <SchemaContext.Provider value={schemaValueMemo}>
              <StyleContext.Provider value={styleValueMemo}>
                <ErrorBoundary>
                  {Plugin.pluginSettings && <Plugin.pluginSettings {...attributes} id={id} onUpdate={handleChange} />}
                  {!Plugin.pluginSettings && <div className="element-tools--empty">Settings not available.</div>}
                </ErrorBoundary>
              </StyleContext.Provider>
            </SchemaContext.Provider>
          </PlitziServiceProvider>
        </ContainerShadow.Content>
      </ContainerShadow>
    );
  }

  const Settings = Plugin?.pluginSettings ?? defaultElementsSettings[type];

  return (
    <PlitziServiceProvider value={plitziContextValue}>
      <SchemaContext.Provider value={schemaValueMemo}>
        <StyleContext.Provider value={styleValueMemo}>
          <ErrorBoundary>
            {Settings && <Settings {...attributes} id={id} onUpdate={handleChange} />}
            {!Settings && <div className="element-tools--empty">Settings not available.</div>}
          </ErrorBoundary>
        </StyleContext.Provider>
      </SchemaContext.Provider>
    </PlitziServiceProvider>
  );
};

ElementSettings.propTypes = {
  id: PropTypes.string,
  type: PropTypes.string,
  attributes: PropTypes.object,
  handleChange: PropTypes.func
};

export default ElementSettings;
