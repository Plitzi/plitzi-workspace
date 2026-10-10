import type { PluginComponent } from './deferredPlugins';
import type { Asset, ComponentDefinition } from '@plitzi/sdk-shared';
import type { FC } from 'react';

export type SdkPluginProps = {
  renderType: string;
  /** The component, taking its element's attributes as props — as `render()`'s plugins do (see `RenderPlugins`). */
  component: PluginComponent;
  // The panel takes the plugin's own attributes as its props, which only the plugin knows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: FC<any>;
  definition?: ComponentDefinition;
  assets?: Asset[];
};

const SdkPlugin = (_props: SdkPluginProps) => undefined; // eslint-disable-line

export default SdkPlugin;
