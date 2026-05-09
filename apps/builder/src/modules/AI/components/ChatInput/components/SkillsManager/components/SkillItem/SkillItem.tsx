import clsx from 'clsx';
import { useCallback } from 'react';

import { SOURCE_BADGE_CLASS } from '../../helpers';

import type { AiSkill } from '@pmodules/AI/types';

export type SkillItemProps = {
  skill: AiSkill;
  onToggle: (id: string) => void;
};

const SkillItem = ({ skill, onToggle }: SkillItemProps) => {
  const handleToggle = useCallback(() => {
    onToggle(skill.id);
  }, [skill.id, onToggle]);

  return (
    <div
      className={clsx(
        'grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border p-3 transition-colors',
        skill.enabled
          ? 'border-neutral-300 bg-neutral-100 dark:border-zinc-600 dark:bg-zinc-800'
          : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
      )}
    >
      <div
        className={clsx(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg border',
          skill.enabled
            ? 'border-neutral-400 bg-neutral-200 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-200'
            : 'border-neutral-200 bg-neutral-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500'
        )}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{skill.name}</span>
          <code className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-px font-mono text-[9.5px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            /{skill.slash}
          </code>
          <span
            className={clsx(
              'rounded border px-1.5 py-px font-mono text-[8.5px] tracking-wide uppercase',
              SOURCE_BADGE_CLASS[skill.source]
            )}
          >
            {skill.source}
          </span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{skill.desc}</p>
        {(skill.runs !== undefined || skill.avg || skill.lastUsed) && (
          <div className="mt-1.5 flex gap-3 font-mono text-[9.5px] text-zinc-400 dark:text-zinc-600">
            {skill.runs !== undefined && (
              <span>
                <span className="text-zinc-600 dark:text-zinc-400">{skill.runs}</span> runs
              </span>
            )}
            {skill.avg && (
              <span>
                avg <span className="text-zinc-600 dark:text-zinc-400">{skill.avg}</span>
              </span>
            )}
            {skill.lastUsed && (
              <span>
                last <span className="text-zinc-600 dark:text-zinc-400">{skill.lastUsed}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleToggle}
        title={skill.enabled ? 'Disable' : 'Enable'}
        className={clsx(
          'relative mt-0.5 h-[17px] w-[30px] shrink-0 cursor-pointer rounded-full border transition-all',
          skill.enabled
            ? 'border-zinc-500 bg-zinc-700 dark:border-zinc-400 dark:bg-zinc-500'
            : 'border-neutral-300 bg-neutral-200 dark:border-zinc-700 dark:bg-zinc-800'
        )}
      >
        <span
          className={clsx(
            'absolute top-[1px] h-[13px] w-[13px] rounded-full transition-all',
            skill.enabled ? 'left-[14px] bg-white' : 'left-[1px] bg-zinc-400 dark:bg-zinc-600'
          )}
        />
      </button>
    </div>
  );
};

export default SkillItem;
