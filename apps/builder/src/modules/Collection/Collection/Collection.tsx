import Button from '@plitzi/plitzi-ui/Button';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use, useEffect, useState } from 'react';

import CollectionRecords from './CollectionRecords';
import CollectionContext from '../CollectionContext';
import CollectionRecordForm from '../Models/CollectionRecordForm';

import type { Collection as TCollection, CollectionRecord } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type CollectionProps = {
  id: string;
  records: TCollection['records'];
  fields: TCollection['fields'];
  name: TCollection['name'];
  onUpdateMode?: (mode: boolean) => void;
};

const Collection = ({ id, records, fields, name, onUpdateMode }: CollectionProps) => {
  const { showModal, showDialog } = useModal();
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const { addRecord, updateRecord, removeRecord, fetchRecords } = use(CollectionContext);

  const handleClickUpdateRecord = useCallback(
    (recordId: string) => async (e: MouseEvent) => {
      e.stopPropagation();
      const record = records.find(record => record.id === recordId);
      if (!record) {
        return;
      }

      const response = await showModal<{ record: Omit<CollectionRecord, 'createdAt' | 'updatedAt'> }>(
        <Modal.Header>
          <h4>{name} Record</h4>
        </Modal.Header>,
        ({ onSubmit, onClose }) => (
          <Modal.Body className="p-0">
            <CollectionRecordForm
              onSubmit={onSubmit}
              onClose={onClose}
              id={recordId}
              fields={Object.values(fields)}
              values={record.values}
            />
          </Modal.Body>
        ),
        undefined,
        { style: { width: '500px', maxHeight: '80vh', maxWidth: 'none' } }
      );

      if (response) {
        const { status, values } = response.record;
        void updateRecord(id, recordId, status, values);
      }
    },
    [id, records, fields, name, showModal, updateRecord]
  );

  const handleClickRemoveRecord = useCallback(
    (recordId: string) => async (e: MouseEvent) => {
      e.stopPropagation();
      const response = await showDialog(
        <Modal.Header>
          <h4>Remove Record</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-3 py-2">
            <h4>Do you want to remove this item ?</h4>
          </div>
        </Modal.Body>
      );

      if (response) {
        void removeRecord(id, recordId);
      }
    },
    [id, removeRecord, showDialog]
  );

  const fetch = useCallback(
    async (recordsToAppend: CollectionRecord[] = []) => {
      if ((recordsToAppend.length > 0 && !cursor) || !id) {
        return;
      }

      const result = await fetchRecords(id, {}, cursor as string, 20, recordsToAppend);
      if (result) {
        const { pageInfo } = result;
        setCursor(pageInfo.nextCursor);
        setHasNextPage(pageInfo.hasNextPage);
      }
    },
    [cursor, fetchRecords, id]
  );

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const handleClickSettings = useCallback(() => onUpdateMode?.(true), [onUpdateMode]);

  const handleClickMore = useCallback(() => fetch(records), [records, fetch]);

  const handleClickAddRecord = useCallback(async () => {
    const response = await showModal<{ record: Omit<CollectionRecord, 'createdAt' | 'updatedAt'> }>(
      <Modal.Header>
        <h4>Add {name} Record</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body className="p-0">
          <CollectionRecordForm onSubmit={onSubmit} onClose={onClose} fields={Object.values(fields)} />
        </Modal.Body>
      ),
      undefined,
      { style: { width: '500px', maxHeight: '80vh', maxWidth: 'none' } }
    );

    if (response && id) {
      const { status, values } = response.record;
      void addRecord(id, status, values);
    }
  }, [id, fields, name, showModal, addRecord]);

  return (
    <div className="flex w-full grow basis-0 flex-col p-4">
      <div className="mb-4 flex w-full items-center justify-end">
        <div className="flex">
          <Button className="mr-2 rounded-md" title="Export">
            <i className="fas fa-cloud-download-alt" />
          </Button>
          <Button className="mr-2 rounded-md" title="Import">
            <i className="fas fa-cloud-upload-alt" />
          </Button>
          <Button className="mr-2 rounded-md" onClick={handleClickSettings} title="Settings">
            <i className="fas fa-cog" />
          </Button>
          <Button className="rounded-md capitalize" onClick={handleClickAddRecord}>{`New ${name}`}</Button>
        </div>
      </div>
      <div className="overflow-auto">
        <CollectionRecords
          items={records}
          fields={fields}
          onUpdate={handleClickUpdateRecord}
          onRemove={handleClickRemoveRecord}
        />
      </div>
      {hasNextPage && (
        <div className="mt-2 flex justify-center">
          <Button className="rounded-sm" onClick={handleClickMore}>
            Fetch More Records
          </Button>
        </div>
      )}
    </div>
  );
};

export default Collection;
