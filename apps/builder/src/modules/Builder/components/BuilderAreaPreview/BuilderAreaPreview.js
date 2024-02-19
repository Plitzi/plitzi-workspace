// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import classNames from 'classnames';
import { ComponentContext, PlitziServiceProvider } from '@plitzi/plitzi-sdk';
import ContainerShadow from '@plitzi/plitzi-ui-components/ContainerShadow';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import SchemaContext from '@repo/schema-shared/SchemaContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';

// Alias
import PluginsContext from '@pmodules/Plugins/PluginsContext';
import NetworkContext from '@pmodules/Network/NetworkContext';
import NavigationContext from '@pmodules/Navigation/NavigationContext';
import StateManagerContext from '@pmodules/StateManager/StateManagerContext';
import InteractionsBuilderContextProvider from '@pmodules/Interactions/InteractionsBuilderContextProvider';
import AppContext from '@pmodules/App/AppContext';
import UserContextProvider from '@pmodules/User/UserContextProvider';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';

// Relatives
import { DISPLAY_BORDER_BLACK, DISPLAY_BORDER_WHITE } from '../../BuilderHelper';
import { emptyObject } from '../../../../helpers/utils';

// Style
import styleFrame from '!!css-loader!postcss-loader!sass-loader!../../../Builder/Assets/index-iframe.scss'; // eslint-disable-line

// SDK Style
import sdkStyle from '!css-loader!postcss-loader!@plitzi/plitzi-sdk/plitzi-sdk.css'; // eslint-disable-line

const BuilderAreaPreview = props => {
  const { id = '', className = '', previewMode = false, schema = emptyObject, styleCache = '' } = props;
  const { settings, flat } = schema;
  const { displayBorderComponents } = useContext(AppContext);

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

  const { components } = useContext(ComponentContext);
  const element = useMemo(() => get(flat, id), [id, flat]);
  const Plugin = useMemo(() => get(components, get(element, 'definition.type')), [components, element]);
  const internalProps = useMemo(() => ({ id, rootId: id }), [id]);

  return (
    <ContainerShadow className={classNames('flex', className)}>
      <ContainerShadow.Content>
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
      </ContainerShadow.Content>
    </ContainerShadow>
  );
};

BuilderAreaPreview.propTypes = {
  className: PropTypes.string,
  previewMode: PropTypes.bool,
  id: PropTypes.string,
  schema: PropTypes.object,
  styleCache: PropTypes.string
};

export default BuilderAreaPreview;
