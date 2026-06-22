import { StoreProvider } from '@plitzi/nexus/react';
import { useCallback, useState } from 'react';

import { useDraftSetter } from '../../draftStore';
import DraftEditor from '../DraftEditor';
import DraftSavedView from '../DraftSavedView';

import type { Profile } from '../../draftStore';

const DraftBody = () => {
  const [editing, setEditing] = useState(false);
  const setState = useDraftSetter();

  const handleEdit = useCallback(() => setEditing(true), []);
  const handleCancel = useCallback(() => setEditing(false), []);
  const handleSave = useCallback(
    (profile: Profile) => {
      setState('profile', profile);
      setEditing(false);
    },
    [setState]
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DraftSavedView />

      {!editing && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-ink-700 p-4">
          <button
            onClick={handleEdit}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
          >
            Edit profile
          </button>
        </div>
      )}

      {editing && (
        <StoreProvider inherit="snapshot">
          <DraftEditor onSave={handleSave} onCancel={handleCancel} />
        </StoreProvider>
      )}
    </div>
  );
};

export default DraftBody;
