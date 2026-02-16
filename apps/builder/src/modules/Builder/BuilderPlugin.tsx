/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Asset, ComponentDefinition, ComponentPluginFC } from '@plitzi/sdk-shared';
import type { FC } from 'react';

export type BuilderPluginProps = {
  renderType: string;
  component: ComponentPluginFC;
  settings?: FC<any>;
  definition?: ComponentDefinition;
  assets?: Asset[];
};

const BuilderPlugin = (_props: BuilderPluginProps) => undefined; // eslint-disable-line

export default BuilderPlugin;
