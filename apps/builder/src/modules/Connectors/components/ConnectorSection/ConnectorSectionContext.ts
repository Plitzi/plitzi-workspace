import { createContext } from 'react';

export type ConnectorSectionContextValue = {
  /** Whether the surrounding section is currently showing its field-level prose. */
  showHelp: boolean;
  /** How deep this section sits. Sections read it to indent and tint themselves relative to their parent. */
  depth: number;
};

const ConnectorSectionContext = createContext<ConnectorSectionContextValue>({ showHelp: false, depth: 0 });
ConnectorSectionContext.displayName = 'ConnectorSectionContext';

export default ConnectorSectionContext;
