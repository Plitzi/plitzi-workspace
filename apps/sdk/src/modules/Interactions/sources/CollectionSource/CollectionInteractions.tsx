import { get, pick } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo } from 'react';

import { collectionFieldTypeToInteractions } from '@plitzi/sdk-collections/CollectionsHelper';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';

import type {
  Collection,
  CollectionRecord,
  InteractionCallback,
  InteractionCallbackParamValues
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type CollectionInteractionsProps = {
  children: ReactNode;
};

const CollectionInteractions = ({ children }: CollectionInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);
  const { collections, addRecord, updateRecord, removeRecord } = use(CollectionContext);

  const validateCollection = useCallback((collection: Collection, values: Record<string, unknown>) => {
    if (!(collection as Collection | undefined)) {
      return false;
    }

    const { fields } = collection;
    if (typeof fields !== 'object') {
      return true;
    }

    const fieldsRequired = Object.values(fields).filter(field => field.params.required);
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
    async (
      params: InteractionCallbackParamValues<{ collectionId: string; recordStatus: CollectionRecord['status'] }>
    ) => {
      const { collectionId, recordStatus = 'draft' } = params;
      const collection = get(collections, collectionId, undefined);
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
    async (
      params: InteractionCallbackParamValues<{
        collectionId: string;
        recordStatus: CollectionRecord['status'];
        recordId: string;
      }>
    ) => {
      const { collectionId, recordStatus = 'draft', recordId } = params;
      const collection = get(collections, collectionId, undefined);
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
    async (params: InteractionCallbackParamValues<{ collectionId: string; recordId: string }>) => {
      const { collectionId, recordId } = params;
      const collection = get(collections, collectionId, undefined);
      if (!collection || !recordId) {
        return { success: false, record: undefined };
      }

      await removeRecord(collectionId, recordId);

      return { success: true, collectionId, recordId };
    },
    [collections, removeRecord]
  );

  const collectionsParsed = useMemo(() => {
    if (!(collections as Record<string, Collection> | undefined) || typeof collections !== 'object') {
      return [];
    }

    return Object.keys(collections).reduce<{ value: string; label: string }[]>((acum, collectionId) => {
      const collection = collections[collectionId];
      const collectionName = get(collection, 'name', collectionId);

      return [...acum, { value: collectionId, label: collectionName }];
    }, []);
  }, [collections]);

  const interactionCallbacks = useMemo(
    () => ({
      addCollectionRecord: {
        action: 'addCollectionRecord',
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
                  when: (
                    params: InteractionCallbackParamValues<{
                      collectionId: string;
                      recordStatus: string;
                      [key: string]: unknown;
                    }>
                  ) => !!params.collectionId,
                  type: collectionFieldTypeToInteractions(type)
                }
              };
            }, {})
          };
        }
      } as InteractionCallback<{ collectionId: string; recordStatus: string; [key: string]: unknown }>,
      updateCollectionRecord: {
        action: 'updateCollectionRecord',
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
              options: params => {
                const { collectionId } = params;
                const collection = collections[collectionId];
                if (!collectionId || !(collection as Collection | undefined)) {
                  return [];
                }

                const primaryField = Object.values(collection.fields).find(field => field.params.primary);

                return collection['records'].map(record => {
                  let label = '';
                  if (primaryField) {
                    label = record.values[primaryField.machineName] as string;
                  } else {
                    label = JSON.stringify(record.values);
                  }

                  return { value: record.id, label };
                });
              }
            },
            ...Object.values(fields).reduce((acum, field) => {
              const { machineName, name, type } = field;

              return {
                ...acum,
                [machineName]: {
                  label: name,
                  defaultValue: undefined,
                  when: (
                    params: InteractionCallbackParamValues<{
                      collectionId: string;
                      recordStatus: string;
                      recordId: string;
                      [key: string]: unknown;
                    }>
                  ) => !!params.collectionId,
                  type: collectionFieldTypeToInteractions(type)
                }
              };
            }, {})
          };
        }
      } as InteractionCallback<{
        collectionId: string;
        recordStatus: string;
        recordId: string;
        [key: string]: unknown;
      }>,
      removeCollectionRecord: {
        action: 'removeCollectionRecord',
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
            options: params => {
              const { collectionId } = params;
              const collection = collections[collectionId];
              if (!collectionId || !(collection as Collection | undefined)) {
                return [];
              }

              const primaryField = Object.values(collection.fields).find(field => field.params.primary);

              return collection['records'].map(record => {
                let label = '';
                if (primaryField) {
                  label = record.values[primaryField.machineName] as string;
                } else {
                  label = JSON.stringify(record.values);
                }

                return { value: record.id, label };
              });
            }
          }
        }
      } satisfies InteractionCallback<{ collectionId: string; recordId: string }>
    }),
    [
      collections,
      collectionsParsed,
      handleAddCollectionRecord,
      handleRemoveCollectionRecord,
      handleUpdateCollectionRecord
    ]
  );

  useInteractions({
    id: 'collection',
    callbacks: interactionCallbacks as unknown as Record<string, InteractionCallback>
  });

  return children;
};

export default CollectionInteractions;
