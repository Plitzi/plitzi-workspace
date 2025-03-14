import { createContext } from 'react';

import { EMPTY_STYLE_SCHEMA } from './StyleHelper';

import type { Style } from '@plitzi/sdk-shared';

export type StyleContextValue = Style;

const styleContextDefaultValue: StyleContextValue = EMPTY_STYLE_SCHEMA;

const StyleContext = createContext<StyleContextValue | undefined>(styleContextDefaultValue);

export default StyleContext;
