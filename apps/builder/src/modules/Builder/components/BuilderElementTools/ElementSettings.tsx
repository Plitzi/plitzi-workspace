import Button from '@plitzi/plitzi-ui/Button';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Heading from '@plitzi/plitzi-ui/components/Heading';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import ContainerShadow from '@plitzi/plitzi-ui/ContainerShadow';
import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import Select from '@plitzi/plitzi-ui/Select';
import Select2 from '@plitzi/plitzi-ui/Select2';
import Switch from '@plitzi/plitzi-ui/Switch';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, use, useMemo } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import AppContext from '@pmodules/App/AppContext';
import CollectionContext from '@pmodules/Collection/CollectionContext';
import NetworkContext from '@pmodules/Network/NetworkContext';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';

import { defaultElementsSettings } from '../../../../SdkComponents';

import type { ComponentPlugin } from '@plitzi/sdk-shared';
import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import type { FC } from 'react';

const uiComponents = { Input, Select, Checkbox, CodeMirror, TextArea, Button, Select2, Switch, QueryBuilder, KVInput };

export type ElementSettingsProps = {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
  handleChange?: (key: string, value: string | boolean | number | object, isDefinition?: boolean) => void;
};

const ElementSettings = ({ id = '', type = '', attributes = emptyObject, handleChange }: ElementSettingsProps) => {
  const { previewMode, displayBorderComponents } = use(AppContext);
  const { getComponent } = use(ComponentContext);
  const Plugin = getComponent(type) as ComponentPlugin | undefined;
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

  const plitziContextValue = useMemo<PlitziServiceContextValue>(
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
      customContexts: { ContainerRootContext },
      contexts: {
        ComponentContext,
        CollectionContext,
        NetworkContext,
        StyleContext,
        PluginsContext,
        NavigationContext,
        DataSourceContext,
        SchemaContext,
        StateManagerContext,
        SegmentsContext,
        EventBridgeContext,
        InteractionsContext
      }
    }),
    [previewMode, currentPageId, baseElementId, displayBorderComponents, getWindow, rootDOM]
  );

  const schemaValueMemo = useMemo(() => ({ schema }), [schema]);
  const styleValueMemo = useMemo(() => ({ style }), [style]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Settings = (Plugin?.pluginSettings ?? defaultElementsSettings[type]) as FC<any> | undefined;

  const children = useMemo(
    () => (
      <PlitziServiceProvider value={plitziContextValue}>
        <SchemaContext value={schemaValueMemo}>
          <StyleContext value={styleValueMemo}>
            <ErrorBoundary>
              {Settings && (
                <div className="flex h-full flex-col">
                  <Heading as="h5">Settings</Heading>
                  <Settings {...attributes} id={id} onUpdate={handleChange} uiComponents={uiComponents} />
                </div>
              )}
              {!Settings && <div className="element-tools--empty">Settings not available.</div>}
            </ErrorBoundary>
          </StyleContext>
        </SchemaContext>
      </PlitziServiceProvider>
    ),
    [Settings, attributes, handleChange, id, plitziContextValue, schemaValueMemo, styleValueMemo]
  );

  if (Plugin && pluginStyles?.[type] && pluginStyles[type].length > 0) {
    return (
      <ContainerShadow
        className="flex h-full flex-col"
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
        <ContainerShadow.Content>{children}</ContainerShadow.Content>
      </ContainerShadow>
    );
  }

  return children;
};

export default ElementSettings;
