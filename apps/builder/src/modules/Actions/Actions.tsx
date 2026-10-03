import Alert from '@plitzi/plitzi-ui/Alert';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use, useMemo, useState } from 'react';

import ViewPage from '@pmodules/App/components/ViewPage';

import ActionsContext from './ActionsContext';
import ActionForm from './components/ActionForm';
import ActionList from './components/ActionList';

import type { ActionDocument } from '@plitzi/sdk-shared';

const Actions = () => {
  const {
    actions,
    tasks,
    credentials,
    deployments,
    isLoading,
    error,
    addAction,
    updateAction,
    removeAction,
    runAction
  } = use(ActionsContext);
  const { showDialog } = useModal();
  const [editing, setEditing] = useState<string | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);

  const items = useMemo(() => Object.values(actions), [actions]);
  const action = editing ? actions[editing] : undefined;
  const isEditing = isCreating || Boolean(action);

  const handleCreate = useCallback(() => {
    setEditing(undefined);
    setIsCreating(true);
  }, []);

  const handleCancel = useCallback(() => {
    setEditing(undefined);
    setIsCreating(false);
  }, []);

  const handleSubmit = useCallback(
    async (name: string, document: ActionDocument) => {
      const saved = action ? await updateAction(action.identifier, name, document) : await addAction(name, document);
      // A refused write answers nothing and reports itself with a toast — it never throws. Closing the editor on it
      // anyway discards the edits behind a modal the author watched close, which reads exactly like a save.
      if (!saved) {
        return;
      }

      handleCancel();
    },
    [action, updateAction, addAction, handleCancel]
  );

  const handleRemove = useCallback(
    async (identifier: string) => {
      const confirmed = await showDialog(
        <Modal.Header>
          <h4>Remove Action</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-3 py-2">
            <h4>Any step that runs this action will stop working. Remove it?</h4>
          </div>
        </Modal.Body>
      );

      if (confirmed) {
        await removeAction(identifier);
      }
    },
    [showDialog, removeAction]
  );

  return (
    <>
      {isLoading && <ViewPage description="Loading actions…" />}
      {!isLoading && error && (
        <ViewPage>
          <Alert intent="error" size="sm" solid={false}>
            {error}
          </Alert>
        </ViewPage>
      )}
      {!isLoading && !error && !isEditing && (
        <ActionList actions={items} onSelect={setEditing} onRemove={handleRemove} onCreate={handleCreate} />
      )}
      {!isLoading && !error && isEditing && (
        <ActionForm
          key={action?.identifier ?? 'new'}
          action={action}
          tasks={tasks}
          credentials={credentials}
          deployments={deployments}
          onRun={runAction}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}
    </>
  );
};

export default Actions;
