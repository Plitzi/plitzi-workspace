import { PlitziServiceProvider as PlitziServiceContextProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { ElementStoreProvider } from './ElementStore';

import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import type { ReactNode } from 'react';

// Elements-aware service provider: the sdk-shared context provider (`PlitziServiceProvider`) plus the element store
// (`ElementStoreProvider`) that `withElement`/`useElementData` rely on. sdk-shared owns the generic context; the
// element store lives here in sdk-elements, so surfaces that render elements mount this composed provider instead of
// the bare one. Named distinctly from sdk-shared's `PlitziServiceProvider` to avoid confusing the two.
const PlitziElementsProvider = ({ children, value }: { children?: ReactNode; value: PlitziServiceContextValue }) => (
  <PlitziServiceContextProvider value={value}>
    <ElementStoreProvider>{children}</ElementStoreProvider>
  </PlitziServiceContextProvider>
);

export default PlitziElementsProvider;

export { PlitziElementsProvider };
