// Packages
import React, { useMemo, useContext } from 'react';
import get from 'lodash/get';
import pick from 'lodash/pick';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';

// Alias
import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';

// Relatives
import SchemaPagesContext from './SchemaPagesContext';

export const SCHEMA_TYPE_NORMAL = 'normal';
export const SCHEMA_TYPE_PARTIAL = 'partial';
export const SCHEMA_TYPE_TEMPLATE = 'template';
export const SCHEMA_TYPE_SEGMENT = 'segment';

const SchemaContextProvider = props => {
  const { children, type = SCHEMA_TYPE_NORMAL, schema: schemaProp } = props;
  const internalData = useContext(NetworkInternalContext);
  const schema = useMemo(() => {
    if (schemaProp) {
      return schemaProp;
    }

    switch (type) {
      case SCHEMA_TYPE_NORMAL:
        return { settings: { customCss: '' }, flat: {}, pages: [], ...internalData.schema };
      default:
        return { settings: { customCss: '' }, flat: {}, pages: [] };
    }
  }, [schemaProp, internalData]);

  const valueMemo = useMemo(() => ({ schema }), [schema]);

  const schemaPages = useMemo(
    () => ({
      pages: get(schema, 'pages', []),
      pageDefinitions: pick(get(schema, 'flat', {}), get(schema, 'pages', []))
    }),
    [schema.pages]
  );

  const schemaSettings = useMemo(() => schema.settings, [schema.settings]);

  return (
    <SchemaPagesContext.Provider value={schemaPages}>
      <SchemaSettingsContext.Provider value={schemaSettings}>
        <SchemaContext.Provider value={valueMemo}>{children}</SchemaContext.Provider>
      </SchemaSettingsContext.Provider>
    </SchemaPagesContext.Provider>
  );
};

export default SchemaContextProvider;
