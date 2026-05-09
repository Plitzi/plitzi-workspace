import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AiEffort } from '@pmodules/AI/types';

type EffortOption = {
  id: AiEffort;
  label: string;
  desc: string;
  meta: [string, string][];
};

const OPTIONS: EffortOption[] = [
  {
    id: 'low',
    label: 'Low',
    desc: 'Fast responses, minimal reasoning.',
    meta: [
      ['~', '< 1s'],
      ['cost', '1×']
    ]
  },
  {
    id: 'medium',
    label: 'Medium',
    desc: 'Balanced default — thinks before acting.',
    meta: [
      ['~', '~3s'],
      ['cost', '2×']
    ]
  },
  {
    id: 'high',
    label: 'High',
    desc: 'Deep reasoning for complex tasks.',
    meta: [
      ['~', '~12s'],
      ['cost', '5×']
    ]
  }
];

const BARS_FILLED: Record<AiEffort, number> = { low: 1, medium: 2, high: 3 };

type BarsProps = { effort: AiEffort; active?: boolean };

const Bars = ({ effort, active = false }: BarsProps) => {
  const filled = BARS_FILLED[effort];

  return (
    <span className="flex items-end gap-0.5" style={{ height: 10 }}>
      {([4, 7, 10] as const).map((h, i) => (
        <span
          key={i}
          className={clsx(
            'w-0.5 rounded-sm transition-colors',
            i < filled ? (active ? 'bg-current' : 'bg-zinc-400 dark:bg-zinc-500') : 'bg-neutral-300 dark:bg-zinc-700'
          )}
          style={{ height: h }}
        />
      ))}
    </span>
  );
};

export type EffortSelectorProps = {
  value: AiEffort;
  disabled?: boolean;
  onChange: (effort: AiEffort) => void;
};

const EffortSelector = ({ value, disabled = false, onChange }: EffortSelectorProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cur = OPTIONS.find(o => o.id === value) ?? OPTIONS[1];

  const toggle = useCallback(() => setOpen(o => !o), []);

  const handlePick = useCallback(
    (id: AiEffort) => {
      onChange(id);
      setOpen(false);
    },
    [onChange]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);

    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        disabled={disabled}
        onClick={toggle}
        title={`Effort: ${cur.label}`}
        className="flex items-center gap-1.5 rounded border border-neutral-300 bg-neutral-100 px-2 py-1 font-mono text-[9.5px] text-zinc-600 transition-colors hover:border-neutral-400 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
      >
        <Bars effort={value} />
        <span className="tracking-wider uppercase">{cur.label}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 w-52 overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="px-3 pt-2.5 pb-1 font-mono text-[9px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
            Reasoning effort
          </div>
          {OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => handlePick(opt.id)}
              className={clsx(
                'flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-zinc-800',
                opt.id === value && 'bg-neutral-50 dark:bg-zinc-800'
              )}
            >
              <span
                className={clsx(
                  'mt-0.5 flex shrink-0 items-end gap-0.5',
                  opt.id === value ? 'text-emerald-500 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-600'
                )}
                style={{ height: 10 }}
              >
                <Bars effort={opt.id} active={opt.id === value} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={clsx(
                    'block font-mono text-[10.5px] font-semibold tracking-wider uppercase',
                    opt.id === value ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                  )}
                >
                  {opt.label}
                </span>
                <span className="block text-[10px] leading-snug text-zinc-400 dark:text-zinc-600">{opt.desc}</span>
                <span className="mt-1 flex gap-2 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
                  {opt.meta.map(([k, v]) => (
                    <span key={k}>
                      {k} <strong className="text-zinc-500 dark:text-zinc-500">{v}</strong>
                    </span>
                  ))}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EffortSelector;
