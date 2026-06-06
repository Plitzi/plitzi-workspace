import { useDraft } from '../../draftStore';

const DraftSavedView = () => {
  const [name] = useDraft('profile.name');
  const [role] = useDraft('profile.role');
  const [bio] = useDraft('profile.bio');

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">saved · root scope</div>
      <div className="mt-2 text-base font-semibold text-white">{name}</div>
      <div className="text-xs text-brand-300">{role}</div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{bio}</p>
    </div>
  );
};

export default DraftSavedView;
