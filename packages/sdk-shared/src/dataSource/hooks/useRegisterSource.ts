import { useEffect, useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';

import { makeId } from '../../helpers';

import type { SourceMeta } from '../../types';

export type UseRegisterSourceProps = {
  id?: string;
  source: string;
  name: string;
  fields?: SourceMeta['fields'];
};

// Registers a data source's metadata into the root `sources` slice. The write delegates up the scope chain to
// the root (no seeding needed), keeping the builder's binding registry in one place.
const useRegisterSource = ({ id = '', source, name, fields = [] }: UseRegisterSourceProps) => {
  const { useStoreSetter } = createStoreHook<Record<string, unknown>>();
  // Loosely typed: the registry lives under dynamic `sources.<id>` paths the typed setter can't express.
  const setStore = useStoreSetter() as (path: string, value: unknown) => void;
  const uniqueId = useMemo(() => `${id}_${makeId(8)}`, [id]);

  useEffect(() => {
    setStore(`sources.${uniqueId}`, { id: uniqueId, meta: { id, source, name, fields } });

    return () => setStore(`sources.${uniqueId}`, undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueId]);

  useEffect(() => {
    setStore(`sources.${uniqueId}.meta.fields`, fields);
  }, [fields, uniqueId, setStore]);
};

export default useRegisterSource;
