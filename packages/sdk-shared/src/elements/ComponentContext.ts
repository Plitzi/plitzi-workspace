import { sharedContext } from '../react/sharedContext';

import type { ComponentContextValue } from '../types';

const componentContextDefaultValue = {};

const ComponentContext = sharedContext('ComponentContext', componentContextDefaultValue as ComponentContextValue);

export default ComponentContext;
