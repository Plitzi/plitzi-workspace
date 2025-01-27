// Packages
import { Schema } from '@plitzi/sdk-shared';
import { createContext } from 'react';

const schemaSettingsContextValue: Schema['settings'] = {} as Schema['settings'];

const SchemaSettingsContext = createContext(schemaSettingsContextValue);

export default SchemaSettingsContext;
