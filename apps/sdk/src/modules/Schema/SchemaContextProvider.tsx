import { get, pick } from '@plitzi/plitzi-ui/helpers';
import { useMemo, use } from 'react';

import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import SchemaContext from '@plitzi/sdk-shared/schema/SchemaContext';

import SchemaPagesContext from './SchemaPagesContext';

import type { Element, Schema } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SchemaContextProviderProps = {
  children: ReactNode;
  type?: 'normal' | 'partial' | 'template' | 'segment';
  schema?: Schema;
};

const SchemaContextProvider = ({ children, type = 'normal', schema: schemaProp }: SchemaContextProviderProps) => {
  const internalData = use(NetworkInternalContext);
  const schema = useMemo(() => {
    if (schemaProp) {
      return { ...EMPTY_SCHEMA.schema, ...schemaProp };
    }

    switch (type) {
      case 'normal':
        return { ...EMPTY_SCHEMA.schema, ...internalData.schema };
      default:
        return EMPTY_SCHEMA.schema;
    }
  }, [schemaProp, type, internalData.schema]);
  const valueMemo = useMemo(() => ({ schema }), [schema]);
  const schemaPages = useMemo(
    () => ({
      pages: get(schema, 'pages', []),
      pageDefinitions: pick(get(schema, 'flat', {}), get(schema, 'pages', [])) as Record<string, Element>
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema.pages]
  );
  const schemaSettings = useMemo(() => schema.settings, [schema.settings]);

  return (
    <SchemaPagesContext value={schemaPages}>
      <SchemaSettingsContext value={schemaSettings}>
        <SchemaContext value={valueMemo}>{children}</SchemaContext>
      </SchemaSettingsContext>
    </SchemaPagesContext>
  );
};

export default SchemaContextProvider;
