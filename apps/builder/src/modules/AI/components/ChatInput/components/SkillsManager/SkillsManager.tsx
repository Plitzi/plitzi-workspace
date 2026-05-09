import { useCallback, useMemo, useState } from 'react';

import CategoryButton from './components/CategoryButton';
import SkillItem from './components/SkillItem';
import { CATEGORIES } from './helpers';

import type { AiSkill, AiSkillCategory } from '@pmodules/AI/types';
import type { ChangeEvent, MouseEvent } from 'react';

export type SkillsManagerProps = {
  skills: AiSkill[];
  onToggle: (id: string) => void;
  onClose: () => void;
};

const SkillsManager = ({ skills, onToggle, onClose }: SkillsManagerProps) => {
  const [cat, setCat] = useState<AiSkillCategory | 'all'>('all');
  const [q, setQ] = useState('');

  const filtered = skills.filter(
    s =>
      (cat === 'all' || s.cat === cat) &&
      (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.slash.includes(q.toLowerCase()))
  );

  const enabledCount = skills.filter(s => s.enabled).length;

  const countByCategory = useMemo(() => {
    const counts: Partial<Record<AiSkillCategory | 'all', number>> = { all: skills.length };
    for (const s of skills) {
      counts[s.cat] = (counts[s.cat] ?? 0) + 1;
    }

    return counts;
  }, [skills]);

  const handleStopPropagation = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQ(e.target.value);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-[min(580px,80vh)] w-[min(780px,90vw)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={handleStopPropagation}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-5 py-3.5 dark:border-zinc-800">
          <div>
            <span className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">Skills</span>
            <span className="ml-2 font-mono text-[10px] tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
              {enabledCount} active / {skills.length} available
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
            <svg
              className="h-3 w-3 shrink-0 text-zinc-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={q}
              onChange={handleSearchChange}
              placeholder="Search skills…"
              className="w-44 bg-transparent text-[12px] text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200 dark:placeholder:text-zinc-600"
              autoFocus
            />
          </div>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg border border-neutral-200 bg-transparent text-zinc-500 transition-colors hover:border-neutral-300 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-neutral-200 bg-neutral-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
            {CATEGORIES.map(c => (
              <CategoryButton
                key={c.id}
                category={c}
                isActive={cat === c.id}
                count={countByCategory[c.id] ?? 0}
                onSelect={setCat}
              />
            ))}
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {filtered.length === 0 && (
              <div className="flex flex-1 items-center justify-center font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
                No skills found
              </div>
            )}
            {filtered.map(skill => (
              <SkillItem key={skill.id} skill={skill} onToggle={onToggle} />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-neutral-200 px-5 py-2.5 font-mono text-[10px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
          <span>
            <span className="text-zinc-700 dark:text-zinc-300">{enabledCount}</span> active
          </span>
          <span>
            <span className="text-zinc-700 dark:text-zinc-300">{skills.reduce((a, s) => a + (s.runs ?? 0), 0)}</span>{' '}
            total runs
          </span>
        </div>
      </div>
    </div>
  );
};

export default SkillsManager;
