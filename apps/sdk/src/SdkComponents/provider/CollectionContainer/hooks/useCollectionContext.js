// Packages
import { useMemo, useEffect, useState, useContext, useCallback } from 'react';
import isEmpty from 'lodash/isEmpty';
import Handlebars from 'handlebars';

// Relatives
import usePlitziServiceContext from '../../../../services/hooks/usePlitziServiceContext';
import { routeParamsParserToCollection } from '../helpers/Utils';

/**
 * @param {{
 *   source: string;
 *   record: string;
 *   query: string;
 *   limit: number;
 *   appendResults: boolean;
 *   singleRecord: boolean;
 * }} props
 * @returns {{
 *   loading: boolean;
 *   collection: object;
 *   hasNextPage: boolean;
 *   handleNextPage: () => void;
 *   fetch: () => void;
 * }}
 */
const useCollectionContext = (props = {}) => {
  const { source, record, query = '', limit = 1, appendResults = false, singleRecord = false } = props;
  const plitziContext = usePlitziServiceContext();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const {
    contexts: { CollectionContext, NavigationContext }
  } = plitziContext;
  const { routeParams, queryParams } = useContext(NavigationContext);
  const { fetchRecords, fetchCollection } = useContext(CollectionContext);

  // needs to find new user cases
  const queryCompiled = useMemo(() => {
    if (!query) {
      return {};
    }

    try {
      const template = Handlebars.compile(query);
      const queryTemplate = template({ ...queryParams, ...routeParams });

      return { values: routeParamsParserToCollection(JSON.parse(queryTemplate)) };
    } catch (e) {
      // nothing to do
    }

    return {};
  }, [routeParams, queryParams, query]);

  const populateRecords = (collection, records) => {
    const { pageInfo, edges } = records;
    setCursor(pageInfo.nextCursor);
    setHasNextPage(pageInfo.hasNextPage);
    setCollection({
      ...collection,
      records: singleRecord ? null : edges,
      record: singleRecord && edges.length > 0 ? edges[0] : null
    });
  };

  const fetchCollectionInternal = useCallback(async () => {
    setLoading(true);
    const collectionInternal = await fetchCollection(source, queryCompiled);
    setLoading(false);
    if (collectionInternal) {
      populateRecords(collectionInternal, collectionInternal.records);
    }
  }, [queryCompiled, source]);

  const fetchRecordsInternal = useCallback(async () => {
    if (!collection || !source) {
      return;
    }

    setLoading(true);
    const result = await fetchRecords(
      source,
      queryCompiled,
      !appendResults && cursor ? null : cursor,
      parseInt(limit, 10)
      // appendResults ? collection.records : [], // refactor, this one is removed in sdk
    );
    setLoading(false);

    if (result) {
      populateRecords(collection, result);
    }
  }, [source, routeParams, queryParams, appendResults, limit, queryCompiled]);

  const handleNextPage = useCallback(async () => {
    if (!hasNextPage) {
      return;
    }

    await fetchRecordsInternal();
  }, [hasNextPage, fetchRecordsInternal]);

  useEffect(() => {
    if (!isEmpty(source)) {
      fetchCollectionInternal();
    } else {
      setCursor(null);
      setHasNextPage(false);
      setCollection(null);
      setLoading(false);
    }
  }, [source, limit, query, setLoading, fetchRecordsInternal, fetchCollectionInternal]);

  const valueMemo = useMemo(
    () => ({ loading, collection, hasNextPage, handleNextPage, fetch: fetchCollectionInternal }),
    [plitziContext, record, loading, collection, hasNextPage, handleNextPage, fetchCollectionInternal]
  );

  return valueMemo;
};

export default useCollectionContext;
