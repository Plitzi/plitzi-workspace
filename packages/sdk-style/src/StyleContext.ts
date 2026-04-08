import { createContext } from 'react';

import type { StyleContextValue } from '@plitzi/sdk-shared';

const styleContextDefaultValue: StyleContextValue = {};

const StyleContext = createContext(styleContextDefaultValue);
StyleContext.displayName = 'StyleContext';

export default StyleContext;
