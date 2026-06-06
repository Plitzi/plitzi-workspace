import { useCallback } from 'react';

import { useDraft, useDraftGetter } from '../../draftStore';

import type { Profile } from '../../draftStore';
import type { ChangeEvent } from 'react';

export type DraftEditorProps = {
  onSave: (profile: Profile) => void;
  onCancel: () => void;
};

const DraftEditor = ({ onSave, onCancel }: DraftEditorProps) => {
  const [name, setName] = useDraft('profile.name');
  const [role, setRole] = useDraft('profile.role');
  const [bio, setBio] = useDraft('profile.bio');
  const get = useDraftGetter();

  const handleName = useCallback((event: ChangeEvent<HTMLInputElement>) => setName(event.target.value), [setName]);
  const handleRole = useCallback((event: ChangeEvent<HTMLInputElement>) => setRole(event.target.value), [setRole]);
  const handleBio = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => setBio(event.target.value), [setBio]);
  const handleSave = useCallback(() => onSave(get('profile')), [onSave, get]);

  return (
    <div className="rounded-lg border border-brand-700/50 bg-brand-900/10 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-400">draft · snapshot scope</div>

      <div className="mt-3 space-y-2">
        <input
          value={name}
          onChange={handleName}
          className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-white outline-none transition focus:border-brand-500"
        />
        <input
          value={role}
          onChange={handleRole}
          className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-white outline-none transition focus:border-brand-500"
        />
        <textarea
          value={bio}
          onChange={handleBio}
          rows={3}
          className="w-full resize-none rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-white outline-none transition focus:border-brand-500"
        />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500"
        >
          Save to root
        </button>
        <button
          onClick={onCancel}
          className="flex-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-brand-500 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DraftEditor;
