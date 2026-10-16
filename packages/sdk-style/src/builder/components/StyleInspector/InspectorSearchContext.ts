import { createContext } from 'react';

/** What the inspector's search holds, normalized (`search.ts`) — empty while nobody is searching. */
const InspectorSearchContext = createContext('');
InspectorSearchContext.displayName = 'InspectorSearchContext';

export default InspectorSearchContext;
