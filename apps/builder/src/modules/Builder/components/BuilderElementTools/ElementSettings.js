// Packages
import React, { useCallback, use, useMemo } from 'react';
import noop from 'lodash/noop';
import ContainerShadow from '@plitzi/plitzi-ui-components/ContainerShadow';
import ContainerRootContext from '@plitzi/plitzi-ui-components/ContainerRoot/ContainerRootContext';
import ErrorBoundary from '@plitzi/plitzi-ui-components/ErrorBoundary';
import Input from '@plitzi/plitzi-ui-components/Input';
import Select from '@plitzi/plitzi-ui-components/Select';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';
import Button from '@plitzi/plitzi-ui-components/Button';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import Switch from '@plitzi/plitzi-ui-components/Switch';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import KVEditor from '@plitzi/plitzi-ui-components/KVEditor';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';

// Monorepo
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import ComponentContext from '@plitzi/sdk-elements/ComponentContext';
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';

// Alias
import CollectionContext from '@pmodules/Collection/CollectionContext';
import NetworkContext from '@pmodules/Network/NetworkContext';
import AppContext from '@pmodules/App/AppContext';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';

// Relatives
import { defaultElementsSettings } from '../../../../SdkComponents';

const uiComponents = { Input, Select, Checkbox, CodeMirror, TextArea, Button, Select2, Switch, QueryBuilder, KVEditor };

/**
 * @param {{
 *   id?: string;
 *   type?: string;
 *   attributes?: object;
 *   handleChange?: (attributes: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ElementSettings = props => {
  const { id = '', type = '', attributes = emptyObject, handleChange = noop } = props;
  const { previewMode, displayBorderComponents } = use(AppContext);
  const { getComponent } = use(ComponentContext);
  const Plugin = getComponent(type);
  const { pluginStyles } = use(PluginsContext);
  const { currentPageId } = use(NavigationContext);
  const {
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const { rootDOM } = use(ContainerRootContext);

  const { schema } = use(BuilderSchemaContext);
  const { style } = use(BuilderStyleContext);

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
  const Settings = Plugin?.pluginSettings ?? defaultElementsSettings[type];
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
            <SchemaContext value={schemaValueMemo}>
              <StyleContext value={styleValueMemo}>
                <ErrorBoundary>
                  {Settings && <Settings {...attributes} id={id} onUpdate={handleChange} uiComponents={uiComponents} />}
                  {!Settings && <div className="element-tools--empty">Settings not available.</div>}
                </ErrorBoundary>
              </StyleContext>
            </SchemaContext>
          </PlitziServiceProvider>
        </ContainerShadow.Content>
      </ContainerShadow>
    );
  }

  return (
    <PlitziServiceProvider value={plitziContextValue}>
      <SchemaContext value={schemaValueMemo}>
        <StyleContext value={styleValueMemo}>
          <ErrorBoundary>
            {Settings && <Settings {...attributes} id={id} onUpdate={handleChange} uiComponents={uiComponents} />}
            {!Settings && <div className="element-tools--empty">Settings not available.</div>}
          </ErrorBoundary>
        </StyleContext>
      </SchemaContext>
    </PlitziServiceProvider>
  );
};

export default ElementSettings;
