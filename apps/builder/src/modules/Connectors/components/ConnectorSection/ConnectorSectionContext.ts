import { createContext } from 'react';

/** Whether the surrounding section is currently showing its field-level prose. */
const ConnectorSectionContext = createContext(false);
ConnectorSectionContext.displayName = 'ConnectorSectionContext';

export default ConnectorSectionContext;
