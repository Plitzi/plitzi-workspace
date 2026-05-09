import type { AiSkill } from '@pmodules/AI/types';

export type SkillsButtonProps = {
  skills: AiSkill[];
  disabled?: boolean;
  onClick: () => void;
};

const SkillsButton = ({ skills, disabled = false, onClick }: SkillsButtonProps) => {
  const enabledCount = skills.filter(s => s.enabled).length;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="Skills · manage"
      className="flex items-center gap-1 rounded border border-neutral-300 bg-neutral-100 px-2 py-1 font-mono text-[9.5px] text-zinc-500 transition-colors hover:border-neutral-400 hover:text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
    >
      <svg className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span>skills</span>
      <span className="rounded border border-neutral-300 bg-neutral-50 px-1 font-mono text-[8px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
        {enabledCount}
      </span>
    </button>
  );
};

export default SkillsButton;
