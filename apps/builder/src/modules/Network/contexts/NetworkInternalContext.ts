import { createContext } from 'react';

import type { Collection, ComponentDefinition, Schema, Segment, Style } from '@plitzi/sdk-shared';

export type NetworkInternalContextValue = {
  schema: Schema;
  style: Style;
  plugins: Record<string, ComponentDefinition>;
  collections: Record<string, Collection>;
  segments: Record<string, Segment>;
};

const networkInternalContextDefaultValue = {} as NetworkInternalContextValue;

const NetworkInternalContext = createContext(networkInternalContextDefaultValue);

export default NetworkInternalContext;
