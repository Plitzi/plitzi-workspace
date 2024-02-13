// Packages
import { renderToPipeableStream } from 'react-dom/server';

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

import { init, shared } from './modules/Element/PluginRemote';

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
