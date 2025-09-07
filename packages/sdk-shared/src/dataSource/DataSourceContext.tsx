import { createContext } from 'react';

import type { DataSourceContextValue } from '../types';

const dataSourceContextDefaultValue = {} as DataSourceContextValue;

const DataSourceContext = createContext<DataSourceContextValue>(dataSourceContextDefaultValue);

export default DataSourceContext;
