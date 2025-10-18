/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Asset, ComponentDefinition, ComponentPlugin } from '@plitzi/sdk-shared';
import type { FC } from 'react';

export type SdkPluginProps = {
  renderType: string;
  component: ComponentPlugin;
  settings?: FC<any>;
  definition?: ComponentDefinition;
  assets?: Asset[];
};

const SdkPlugin = (_props: SdkPluginProps) => undefined; // eslint-disable-line

export default SdkPlugin;
