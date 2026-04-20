import { isEmpty } from '@plitzi/plitzi-ui/helpers';
import { QueryBuilderFormatter } from '@plitzi/plitzi-ui/QueryBuilder';
import { useMemo, useEffect, useState, use, useCallback } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { Collection, CollectionRecord, PageInfo } from '@plitzi/sdk-shared';

export type UseCollectionContextProps = {
  source: string;
  query?: RuleGroup;
  limit: string;
  appendResults?: boolean;
  singleRecord: boolean;
  previewMode?: boolean;
};

export type UseCollectionContextResult = {
  loading: boolean;
  collection?: Collection;
  hasNextPage: boolean;
  handleNextPage: () => void;
  fetch: () => void;
};
const useCollectionContext = (
  {
    source,
    query,
    limit = '1',
    appendResults = false,
    singleRecord = false,
    previewMode = true
  }: UseCollectionContextProps = {} as UseCollectionContextProps
): UseCollectionContextResult => {
  const plitziContext = usePlitziServiceContext();
  const [collection, setCollection] = useState<(Collection & { record?: CollectionRecord }) | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = useState(false);
  const {
    contexts: { CollectionContext, NavigationContext }
  } = plitziContext;
  const { routeParams, queryParams } = use(NavigationContext);
  const { fetchRecords, fetchCollection } = use(CollectionContext);

  // needs to find new user cases
  const queryCompiled = useMemo(() => {
    if (!previewMode || !query) {
      return '';
    }

    try {
      return QueryBuilderFormatter(query, 'mongodb', false, { queryParams, routeParams });
    } catch {
      // nothing to do
    }

    return '';
  }, [previewMode, query, queryParams, routeParams]);

  const populateRecords = useCallback(
    (collection: Omit<Collection, 'records'>, records: { pageInfo: PageInfo; edges: CollectionRecord[] }) => {
      const { pageInfo, edges } = records;
      setCursor(pageInfo.nextCursor);
      setHasNextPage(pageInfo.hasNextPage);
      setCollection({
        ...collection,
        records: singleRecord ? [] : edges,
        record: singleRecord && edges.length > 0 ? edges[0] : undefined
      });
    },
    [singleRecord]
  );

  const fetchCollectionInternal = useCallback(async () => {
    setLoading(true);
    const collectionInternal = await fetchCollection(source, queryCompiled);
    setLoading(false);
    if (collectionInternal?.records && collectionInternal.records.edges.length > 0) {
      populateRecords(collectionInternal, collectionInternal.records);
    }
  }, [fetchCollection, populateRecords, queryCompiled, source]);

  const fetchRecordsInternal = useCallback(async () => {
    if (!collection || !source) {
      return;
    }

    setLoading(true);
    const result = await fetchRecords(
      source,
      queryCompiled,
      !appendResults && cursor ? undefined : cursor,
      parseInt(limit, 10)
      // appendResults ? collection.records : [], // refactor, this one is removed in sdk
    );
    setLoading(false);

    if (result) {
      populateRecords(collection, result);
    }
  }, [collection, source, fetchRecords, queryCompiled, appendResults, cursor, limit, populateRecords]);

  const handleNextPage = useCallback(async () => {
    if (!hasNextPage) {
      return;
    }

    await fetchRecordsInternal();
  }, [hasNextPage, fetchRecordsInternal]);

  useEffect(() => {
    if (!isEmpty(source)) {
      void fetchCollectionInternal();
    } else {
      setCursor(undefined);
      setHasNextPage(false);
      setCollection(undefined);
      setLoading(false);
    }
  }, [source, fetchCollectionInternal]);

  const valueMemo = useMemo(
    () => ({ loading, collection, hasNextPage, handleNextPage, fetch: fetchCollectionInternal }),
    [loading, collection, hasNextPage, handleNextPage, fetchCollectionInternal]
  );

  return valueMemo;
};

export default useCollectionContext;
