import { createContext } from 'react';

import type { ComponentContextValue } from '../types';

const componentContextDefaultValue = {};

const ComponentContext = createContext(componentContextDefaultValue as ComponentContextValue);

export default ComponentContext;
