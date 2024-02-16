// Packages
import React, { useContext, useMemo } from 'react';
import PropTypes from 'prop-types';

// Monorepo
import SchemaContext from '@repo/schema-shared/SchemaContext';

// Alias
import {
  RENDER_MODE_IFRAME,
  RENDER_MODE_RAW,
  RENDER_MODE_SHADOW,
  RENDER_MODE_SSR,
  RENDER_MODE_WIDGET
} from '@modules/Sdk/Sdk';
import NetworkContext from '@modules/Network/NetworkContext';
import SchemaPagesContext from '@modules/Schema/SchemaPagesContext';
import UserContext from '@modules/User/UserContext';

// Relatives
import NavigationWidget from './NavigationWidget';
import NavigationNormal from './NavigationNormal';
import NavigationSSR from './NavigationSSR';
import { getPaths } from './NavigationHelper';

const NavigationContextProvider = props => {
  const { children, renderMode = RENDER_MODE_IFRAME, currentPageId, previewMode = true } = props;
  const { server } = useContext(NetworkContext);
  const {
    schema: { pageFolders }
  } = useContext(SchemaContext);
  const { pageDefinitions, pages } = useContext(SchemaPagesContext);
  const { authenticated } = useContext(UserContext);

  const paths = useMemo(
    () => getPaths(pages, pageDefinitions, pageFolders, authenticated, previewMode),
    [pages, pageFolders, authenticated, previewMode]
  );

  if (renderMode === RENDER_MODE_WIDGET) {
    return (
      <NavigationWidget currentPageId={currentPageId} server={server} paths={paths}>
        {children}
      </NavigationWidget>
    );
  }

  if (renderMode === RENDER_MODE_SSR && server?.location) {
    return (
      <NavigationSSR currentPageId={currentPageId} server={server} paths={paths}>
        {children}
      </NavigationSSR>
    );
  }

  return (
    <NavigationNormal currentPageId={currentPageId} server={server} paths={paths}>
      {children}
    </NavigationNormal>
  );
};

NavigationContextProvider.propTypes = {
  children: PropTypes.node,
  previewMode: PropTypes.bool,
  currentPageId: PropTypes.string,
  renderMode: PropTypes.oneOf([
    RENDER_MODE_RAW,
    RENDER_MODE_IFRAME,
    RENDER_MODE_SHADOW,
    RENDER_MODE_SSR,
    RENDER_MODE_WIDGET
  ])
};

export default NavigationContextProvider;
