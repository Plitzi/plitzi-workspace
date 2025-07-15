// Packages
import React, { useCallback, use, useEffect, useState } from 'react';
import noop from 'lodash/noop';
import get from 'lodash/get';
import Button from '@plitzi/plitzi-ui-components/Button';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';

// Relatives
import CollectionRecordForm from '../Models/CollectionRecordForm';
import CollectionRecords from './CollectionRecords';
import CollectionContext from '../CollectionContext';

/**
 * @param {{
 *   id?: string;
 *   onUpdateMode?: (mode: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Collection = props => {
  const { id = '', onUpdateMode = noop } = props;
  const { showModal, showDialog } = useModal();
  const [cursor, setCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const { collections, addRecord, updateRecord, removeRecord, fetchRecords } = use(CollectionContext);
  const { records, fields, name } = get(collections, id, {});

  const handleClickUpdateRecord = recordId => async e => {
    e.stopPropagation();
    const record = records.find(record => record.id === recordId);
    if (!record) {
      return;
    }

    const response = await showModal(
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
      updateRecord(id, recordId, status, values);
    }
  };

  const handleClickRemoveRecord = recordId => async e => {
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
      removeRecord(id, recordId);
    }
  };

  const fetch = useCallback(
    async (append = false) => {
      if ((append && !cursor) || !id) {
        return;
      }

      const result = await fetchRecords(id, {}, cursor, 20, append ? records : []);
      if (result) {
        const { pageInfo } = result;
        setCursor(pageInfo.nextCursor);
        setHasNextPage(pageInfo.hasNextPage);
      }
    },
    [cursor, fetchRecords, setCursor, setHasNextPage]
  );

  useEffect(() => {
    fetch();
  }, []);

  const handleClickSettings = useCallback(() => onUpdateMode(true), [onUpdateMode]);

  const handleClickMore = useCallback(() => fetch(true), [fetch]);

  const handleClickAddRecord = async () => {
    const response = await showModal(
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

    if (response) {
      const { status, values } = response.record;
      addRecord(id, status, values);
    }
  };

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
