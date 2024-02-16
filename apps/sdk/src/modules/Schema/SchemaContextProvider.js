// Packages
import React, { useMemo, useContext } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import pick from 'lodash/pick';

// Monorepo
import SchemaContext from '@repo/schema-shared/SchemaContext';

// Alias
import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';

// Relatives
import SchemaSettingsContext from './SchemaSettingsContext';
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

SchemaContextProvider.propTypes = {
  children: PropTypes.node,
  schema: PropTypes.object,
  type: PropTypes.oneOf([SCHEMA_TYPE_NORMAL, SCHEMA_TYPE_PARTIAL, SCHEMA_TYPE_TEMPLATE, SCHEMA_TYPE_SEGMENT])
};

export default SchemaContextProvider;
