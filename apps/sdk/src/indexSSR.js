// Packages
import { renderToPipeableStream } from 'react-dom/server';

// Monorepo
import { init, shared } from '@plitzi/sdk-elements/PluginRemote';

// Relatives
import PlitziSdk, {
  ComponentProvider,
  ComponentContext,
  usePlitziServiceContext,
  PlitziServiceProvider,
  RootElement,
  RENDER_MODE_IFRAME,
  RENDER_MODE_RAW,
  RENDER_MODE_SHADOW,
  RENDER_MODE_SSR
} from '.';

export {
  ComponentProvider,
  ComponentContext,
  usePlitziServiceContext,
  PlitziServiceProvider,
  RootElement,
  RENDER_MODE_IFRAME,
  RENDER_MODE_RAW,
  RENDER_MODE_SHADOW,
  RENDER_MODE_SSR,
  renderToPipeableStream,
  init,
  shared
};

export default PlitziSdk;
