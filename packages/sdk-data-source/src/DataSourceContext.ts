// Packages
import { createContext } from 'react';

// Types
import type useDataSource from './hooks/useDataSource';
import type { DataSourceContextValue as DataSourceContextValueShared } from '@plitzi/sdk-shared';

export type DataSourceContextValue = DataSourceContextValueShared<typeof useDataSource>;

const dataSourceContextDefaultValue = {} as DataSourceContextValue;

const DataSourceContext = createContext<DataSourceContextValue>(dataSourceContextDefaultValue);

export default DataSourceContext;
