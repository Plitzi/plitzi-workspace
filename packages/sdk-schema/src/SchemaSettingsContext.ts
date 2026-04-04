import { createContext } from 'react';

import type { Schema } from '@plitzi/sdk-shared';

export type SchemaSettingsContextValue = Schema['settings'];

const schemaSettingsContextDefaultValue = {} as SchemaSettingsContextValue;

const SchemaSettingsContext = createContext(schemaSettingsContextDefaultValue);

export default SchemaSettingsContext;
