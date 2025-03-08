import { createContext } from 'react';

import type { ComponentContextValue } from '@plitzi/sdk-shared';

const componentContextDefaultValue = {};

const ComponentContext = createContext<ComponentContextValue>(componentContextDefaultValue as ComponentContextValue);

export default ComponentContext;
