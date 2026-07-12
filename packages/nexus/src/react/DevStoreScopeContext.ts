import { createContext } from 'react';

// An app-defined grouping tag that `StoreProvider` attaches to every store it registers in the dev store registry
// (dev only). A devtools panel can then group stores by their origin — e.g. the SDK instance that owns them. Purely a
// labelling channel: it has no effect on store behaviour and is stripped from production builds along with the registry.
const DevStoreScopeContext = createContext<string | undefined>(undefined);
DevStoreScopeContext.displayName = 'DevStoreScopeContext';

export default DevStoreScopeContext;
