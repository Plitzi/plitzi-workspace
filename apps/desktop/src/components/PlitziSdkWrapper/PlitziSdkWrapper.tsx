import { use, useMemo } from 'react';

import PlitziSdk from '@plitzi/plitzi-sdk';

import AppContext from '../../AppContext';

import type { Environment, RenderMode } from '@plitzi/sdk-shared';

export type PlitziSdkWrapperProps = {
  className?: string;
  webKey: string;
  environment?: Environment;
  currentPageId?: string;
  previewMode?: boolean;
  basePath?: string;
  renderMode?: RenderMode;
};

/**
 * A space, rendered in this window.
 *
 * `renderMode` defaults to `raw` rather than to an iframe: the window belongs to this app, so there is nothing to
 * isolate the space from, and a frame here would only add a second scroll container and a second copy of the
 * stylesheet. The 2023 default was `widget`, a mode the SDK no longer has.
 */
const PlitziSdkWrapper = ({
  className,
  webKey,
  environment = 'main',
  currentPageId,
  previewMode = true,
  basePath = '',
  renderMode = 'raw'
}: PlitziSdkWrapperProps) => {
  const app = use(AppContext);
  const server = useMemo(() => ({ ...app.server, basePath }), [app.server, basePath]);

  return (
    <PlitziSdk
      className={className}
      webKey={webKey}
      environment={environment}
      currentPageId={currentPageId}
      server={server}
      previewMode={previewMode}
      renderMode={renderMode}
      // The window's own build decides, and only the development one may: a packaged copy handed to a customer has
      // no business offering the element tree and the store of a space that is not theirs.
      debugMode={app.environment === 'development'}
      branding={false}
    />
  );
};

export default PlitziSdkWrapper;
