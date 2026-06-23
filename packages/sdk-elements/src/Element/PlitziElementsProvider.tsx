import { PlitziServiceProvider as PlitziServiceContextProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import type { ReactNode } from 'react';

// Elements-aware service provider: the sdk-shared context provider (`PlitziServiceProvider`). Per-element resolved
// data is carried by `withElement` itself through `ElementContext`, so no top-level element-store provider is needed.
// Kept as a distinct composed export (named apart from sdk-shared's `PlitziServiceProvider`) so surfaces that render
// elements have a single mount point that can grow element-specific providers if needed.
const PlitziElementsProvider = ({ children, value }: { children?: ReactNode; value: PlitziServiceContextValue }) => (
  <PlitziServiceContextProvider value={value}>{children}</PlitziServiceContextProvider>
);

export default PlitziElementsProvider;

export { PlitziElementsProvider };
