import { createContext } from 'react';

import type { StyleContextValue } from '@plitzi/sdk-shared';

const styleContextDefaultValue: StyleContextValue = {};

const StyleContext = createContext(styleContextDefaultValue);

export default StyleContext;
