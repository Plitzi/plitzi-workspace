import type { Asset, ComponentDefinition, ComponentPluginFC } from '@plitzi/sdk-shared';
import type { FC } from 'react';

export type BuilderPluginProps = {
  renderType: string;
  component: ComponentPluginFC;
  // The panel takes the plugin's own attributes as its props, which only the plugin knows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: FC<any>;
  definition?: ComponentDefinition;
  assets?: Asset[];
};

const BuilderPlugin = (_props: BuilderPluginProps) => undefined; // eslint-disable-line

export default BuilderPlugin;
