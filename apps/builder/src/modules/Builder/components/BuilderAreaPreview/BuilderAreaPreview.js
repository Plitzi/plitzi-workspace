// Packages
import React, { useCallback, use, useMemo } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';
import { ComponentContext, PlitziServiceProvider } from '@plitzi/plitzi-sdk';
import ContainerFrame from '@plitzi/plitzi-ui-components/ContainerFrame';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import UserContextProvider from '@plitzi/sdk-auth/UserContextProvider';
import { emptyObject } from '@plitzi/sdk-shared/utils';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import StateManagerContext from '@pmodules/StateManager/StateManagerContext';
import InteractionsBuilderContextProvider from '@pmodules/Interactions/InteractionsBuilderContextProvider';
import AppContext from '@pmodules/App/AppContext';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';

// Relatives
import { DISPLAY_BORDER_BLACK, DISPLAY_BORDER_WHITE } from '../../BuilderHelper';

// Style
import styleFrame from '!!css-loader!postcss-loader!sass-loader!../../../Builder/Assets/index-iframe.scss'; // eslint-disable-line

// SDK Style
import sdkStyle from '!css-loader!postcss-loader!@plitzi/plitzi-sdk/plitzi-sdk.css'; // eslint-disable-line

/**
 * @param {{
 *   id?: string;
 *   className?: string;
 *   previewMode?: boolean;
 *   schema?: object;
 *   styleCache?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderAreaPreview = props => {
  const { id = '', className = '', previewMode = false, schema = emptyObject, styleCache = '' } = props;
  const { settings, flat } = schema;
  const { displayBorderComponents } = use(AppContext);

  const getWindow = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window;
    }

    // @todo: Hmm what to put here
    return { innerWidth: 1440, innerHeight: 900 };
  }, []);

  const plitziContextValue = useMemo(
    () => ({
      settings: { previewMode, ...settings },
      root: { baseElementId: id },
      utils: { getWindow },
      customContexts: {},
      contexts: {
        PluginsContext,
        DataSourceContext,
        SchemaContext,
        NetworkContext,
        NavigationContext,
        StateManagerContext,
        InteractionsContext,
        SegmentsContext,
        EventBridgeContext
      }
    }),
    [
      settings,
      PluginsContext,
      DataSourceContext,
      SchemaContext,
      NetworkContext,
      NavigationContext,
      StateManagerContext,
      InteractionsContext,
      SegmentsContext,
      EventBridgeContext
    ]
  );

  const css = useMemo(() => {
    const css = `${styleCache}\n${settings?.customCss}`;

    return `${sdkStyle[0][1]}\n${styleFrame[0][1]}\n${css}`;
  }, [settings, styleCache]);

  const { components } = use(ComponentContext);
  const element = useMemo(() => get(flat, id), [id, flat]);
  const Plugin = useMemo(() => get(components, get(element, 'definition.type')), [components, element]);
  const internalProps = useMemo(() => ({ id, rootId: id }), [id]);

  return (
    <ContainerFrame className={classNames('flex', className)}>
      <>
        <style>{css}</style>
        <PlitziServiceProvider value={plitziContextValue}>
          <DataSourceContextProvider>
            <InteractionsBuilderContextProvider>
              <UserContextProvider>
                <div
                  className={classNames('builder-iframe', {
                    'builder--display-component-border display-component-border--black':
                      displayBorderComponents === DISPLAY_BORDER_BLACK,
                    'builder--display-component-border display-component-border--white':
                      displayBorderComponents === DISPLAY_BORDER_WHITE
                  })}
                  style={{ width: '100%', display: 'flex' }}
                >
                  {Plugin && <Plugin internalProps={internalProps} />}
                </div>
              </UserContextProvider>
            </InteractionsBuilderContextProvider>
          </DataSourceContextProvider>
        </PlitziServiceProvider>
      </>
    </ContainerFrame>
  );
};

export default BuilderAreaPreview;
