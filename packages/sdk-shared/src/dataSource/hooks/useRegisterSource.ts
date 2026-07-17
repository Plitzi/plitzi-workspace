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
//
// An empty `source` means the element has no idRef, so it publishes nothing a binding could target: the source is
// simply not registered, and it never appears in the binding picker.
const useRegisterSource = ({ id = '', source, name, fields = [] }: UseRegisterSourceProps) => {
  const { useStoreSetter } = createStoreHook<Record<string, unknown>>();
  // Loosely typed: the registry lives under dynamic `sources.<id>` paths the typed setter can't express.
  const setStore = useStoreSetter() as (path: string, value: unknown, options?: { unmount?: boolean }) => void;
  const uniqueId = useMemo(() => `${id}_${makeId(8)}`, [id]);

  useEffect(() => {
    if (!source) {
      return undefined;
    }

    setStore(`sources.${uniqueId}`, { id: uniqueId, meta: { id, source, name, fields } });

    // `unmount` removes the key outright instead of leaving a dead `sources.<id>: undefined` the source registry
    // would still have to defend against (see `getSourcesByElementId`).
    return () => setStore(`sources.${uniqueId}`, undefined, { unmount: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueId, source]);

  useEffect(() => {
    if (!source) {
      return;
    }

    setStore(`sources.${uniqueId}.meta.fields`, fields);
  }, [fields, source, uniqueId, setStore]);
};

export default useRegisterSource;
