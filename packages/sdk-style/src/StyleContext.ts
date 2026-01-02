import { createContext } from 'react';

import { EMPTY_STYLE_SCHEMA } from './StyleMap';

import type { StyleContextValue } from '@plitzi/sdk-shared';

const styleContextDefaultValue: StyleContextValue = { style: EMPTY_STYLE_SCHEMA };

const StyleContext = createContext<StyleContextValue>(styleContextDefaultValue);

export default StyleContext;
