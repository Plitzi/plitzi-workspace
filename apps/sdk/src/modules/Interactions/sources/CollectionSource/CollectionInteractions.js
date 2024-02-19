// Packages
import { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import pick from 'lodash/pick';

// Monorepo
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';

// Alias
import CollectionContext from '@modules/Collection/CollectionContext';
import { collectionFieldTypeToInteractions } from '@modules/Collection/CollectionsConstants';

const CollectionInteractions = props => {
  const { children } = props;
  const { useInteractions } = useContext(InteractionsContext);
  const { collections, addRecord, updateRecord, fetchRecords, removeRecord } = useContext(CollectionContext);

  const validateCollection = useCallback((collection, values) => {
    if (!collection) {
      return false;
    }

    const { fields } = collection;
    if (!fields || typeof fields !== 'object') {
      return true;
    }

    const fieldsRequired = Object.values(fields).filter(field => field?.params.required);
    if (fieldsRequired.length === 0) {
      return true;
    }

    let isValid = true;
    fieldsRequired.forEach(field => {
      if (!values[field.machineName] && isValid) {
        isValid = false;

        return;
      }
    });

    return isValid;
  }, []);

  const handleAddCollectionRecord = useCallback(
    async params => {
      const { collectionId, recordStatus = 'draft' } = params;
      const collection = get(collections, collectionId);
      if (!collection) {
        return { success: false, record: undefined };
      }

      if (!validateCollection(collection, params)) {
        return { success: false, record: undefined };
      }

      const { fields } = collection;
      const values = pick(params, Object.keys(fields));
      const record = await addRecord(collectionId, recordStatus, values);

      return { success: true, record };
    },
    [addRecord, collections, validateCollection]
  );

  const handleUpdateCollectionRecord = useCallback(
    async params => {
      const { collectionId, recordStatus = 'draft', recordId } = params;
      const collection = get(collections, collectionId);
      if (!collection || !recordId) {
        return { success: false, record: undefined };
      }

      if (!validateCollection(collection, params)) {
        return { success: false, record: undefined };
      }

      const { fields } = collection;
      const values = pick(params, Object.keys(fields));
      const record = await updateRecord(collectionId, recordId, recordStatus, values);

      return { success: true, collectionId, record };
    },
    [collections, updateRecord, validateCollection]
  );

  const handleRemoveCollectionRecord = useCallback(
    async params => {
      const { collectionId, recordId } = params;
      const collection = get(collections, collectionId);
      if (!collection || !recordId) {
        return { success: false, record: undefined };
      }

      await removeRecord(collectionId, recordId);

      return { success: true, collectionId, recordId };
    },
    [collections, removeRecord, validateCollection]
  );

  const collectionsParsed = useMemo(() => {
    if (!collections || typeof collections !== 'object') {
      return [];
    }

    return Object.keys(collections).reduce((acum, collectionId) => {
      const collection = collections[collectionId];
      const collectionName = get(collection, 'name', collectionId);

      return [...acum, { value: collectionId, label: collectionName }];
    }, []);
  }, [collections]);

  const interactionCallbacks = useMemo(
    () => ({
      addCollectionRecord: {
        title: 'Add Collection Record',
        type: 'globalCallback',
        callback: handleAddCollectionRecord,
        preview: { success: '', collectionId: '', record: { id: '', status: '', values: {} } },
        params: params => {
          const fields = get(collections, `${params.collectionId}.fields`, {});

          return {
            collectionId: {
              label: 'Collection',
              defaultValue: undefined,
              type: 'select',
              options: collectionsParsed
            },
            recordStatus: {
              label: 'Record Status',
              defaultValue: 'draft',
              type: 'select',
              options: [
                { value: 'published', label: 'Published' },
                { value: 'draft', label: 'Draft' },
                { value: 'archived', label: 'Archived' },
                { value: 'deleted', label: 'Deleted' },
                { value: 'created', label: 'Created' }
              ]
            },
            ...Object.values(fields).reduce((acum, field) => {
              const { machineName, name, type } = field;

              return {
                ...acum,
                [machineName]: {
                  label: name,
                  defaultValue: undefined,
                  when: params => !!params.collectionId,
                  type: collectionFieldTypeToInteractions(type)
                }
              };
            }, {})
          };
        }
      },
      updateCollectionRecord: {
        title: 'Update Collection Record',
        type: 'globalCallback',
        callback: handleUpdateCollectionRecord,
        preview: { success: '', collectionId: '', record: { id: '', status: '', values: {} } },
        params: params => {
          const fields = get(collections, `${params.collectionId}.fields`, {});

          return {
            collectionId: {
              label: 'Collection',
              defaultValue: undefined,
              type: 'select',
              options: collectionsParsed
            },
            recordStatus: {
              label: 'Record Status',
              defaultValue: 'draft',
              type: 'select',
              options: [
                { value: 'published', label: 'Published' },
                { value: 'draft', label: 'Draft' },
                { value: 'archived', label: 'Archived' },
                { value: 'deleted', label: 'Deleted' },
                { value: 'created', label: 'Created' }
              ]
            },
            recordId: {
              label: 'Record',
              defaultValue: undefined,
              type: 'select',
              when: params => !!params.collectionId,
              options: async params => {
                const { collectionId } = params;
                if (!collectionId) {
                  return [];
                }

                const response = await fetchRecords(collectionId);

                return response?.edges.map(record => ({ value: record.id, label: JSON.stringify(record?.values) }));
              }
            },
            ...Object.values(fields).reduce((acum, field) => {
              const { machineName, name, type } = field;

              return {
                ...acum,
                [machineName]: {
                  label: name,
                  defaultValue: undefined,
                  when: params => !!params.collectionId,
                  type: collectionFieldTypeToInteractions(type)
                }
              };
            }, {})
          };
        }
      },
      removeCollectionRecord: {
        title: 'Remove Collection Record',
        type: 'globalCallback',
        callback: handleRemoveCollectionRecord,
        preview: { success: '', collectionId: '', recordId: '' },
        params: {
          collectionId: {
            label: 'Collection',
            defaultValue: undefined,
            type: 'select',
            options: collectionsParsed
          },
          recordId: {
            label: 'Record',
            defaultValue: undefined,
            type: 'select',
            when: params => !!params.collectionId,
            options: async params => {
              const { collectionId } = params;
              if (!collectionId) {
                return [];
              }

              const response = await fetchRecords(collectionId);

              return response?.edges.map(record => ({ value: record.id, label: JSON.stringify(record?.values) }));
            }
          }
        }
      }
    }),
    [collections, handleAddCollectionRecord]
  );

  useInteractions({ id: 'collection', callbacks: interactionCallbacks });

  return children;
};

CollectionInteractions.propTypes = {
  children: PropTypes.node
};

export default CollectionInteractions;
