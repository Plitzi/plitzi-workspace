import { createContext } from 'react';

import type { ComponentContextValue } from '../types';

const componentContextDefaultValue = {};

const ComponentContext = createContext(componentContextDefaultValue as ComponentContextValue);
ComponentContext.displayName = 'ComponentContext';

export default ComponentContext;
