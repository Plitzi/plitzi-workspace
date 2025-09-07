import { createContext } from 'react';

import type { Collection, ComponentDefinition, Schema, Segment, Style } from '@plitzi/sdk-shared';
import type { Template } from '@pmodules/Templates/TemplatesContext';

export type NetworkInternalContextValue = {
  schema: Schema;
  style: Style;
  plugins: Record<string, ComponentDefinition>;
  templates: Record<string, Template>;
  collections: Record<string, Collection>;
  segments: Record<string, Segment>;
};

const networkInternalContextDefaultValue = {} as NetworkInternalContextValue;

const NetworkInternalContext = createContext<NetworkInternalContextValue>(networkInternalContextDefaultValue);

export default NetworkInternalContext;
