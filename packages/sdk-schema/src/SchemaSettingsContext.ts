// Packages
import { createContext } from 'react';

// Types
import type { Schema } from '@plitzi/sdk-shared';

export type SchemaSettingsContextValue = Schema['settings'];

const schemaSettingsContextDefaultValue = {} as SchemaSettingsContextValue;

const SchemaSettingsContext = createContext<Schema['settings']>(schemaSettingsContextDefaultValue);

export default SchemaSettingsContext;
