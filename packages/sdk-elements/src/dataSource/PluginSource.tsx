import { useCallback, useMemo } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import { getSourceName } from '@plitzi/sdk-shared/dataSource/helpers';

import pathFields from './pathFields';
import sourceStore from './sourceStore';
import useRegisterSource from './useRegisterSource';
import useElement from '../Element/hooks/useElement';

import type { ReactNode } from 'react';

/** What `PluginSource` reads of a declaration: the name its source is published under, which authoring checks too. */
export type PluginSourceDeclaration = { type: string; sourceType: string };

export type PluginSourceProps<Data extends Record<string, unknown>> = {
  declaration: PluginSourceDeclaration;
  /** What the elements inside it bind to: `{{ <sourceType>_<id>.<field> }}`. */
  data: Data;
  children?: ReactNode;
};

/**
 * A plugin's own data source, for the elements put inside it: a player's track and whether it plays, read by the
 * space's own buttons and text — what a list, a form or a carousel publishes, under the name its declaration's
 * `sourceType` gives, so `plitzi explain` and the binding checks know it. A run's player had none, and kept its state
 * in `runtime.state` for every page to see instead.
 *
 * Only what is inside it reads it: a source is the elements' scope, not the page's.
 */
const PluginSource = <Data extends Record<string, unknown>>({
  declaration,
  data,
  children
}: PluginSourceProps<Data>) => {
  const {
    id,
    definition: { label = '' }
  } = useElement();
  const source = getSourceName(declaration.sourceType, id);
  const fields = useCallback(() => pathFields(data), [data]);
  useRegisterSource({ id, source, name: label || `${declaration.type} - ${id}`, fields });

  const value = useMemo(() => sourceStore(source, data), [source, data]);

  return (
    <StoreProvider inherit="live" name={`${declaration.type}:${id}`} value={value}>
      {children}
    </StoreProvider>
  );
};

export default PluginSource;
