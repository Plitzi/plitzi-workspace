import { createContext } from 'react';

import { EMPTY_STYLE_SCHEMA } from './StyleHelper';

import type { Style } from '@plitzi/sdk-shared';

export type StyleContextValue = { style: Style };

const styleContextDefaultValue: StyleContextValue = { style: EMPTY_STYLE_SCHEMA };

const StyleContext = createContext<StyleContextValue>(styleContextDefaultValue);

export default StyleContext;
