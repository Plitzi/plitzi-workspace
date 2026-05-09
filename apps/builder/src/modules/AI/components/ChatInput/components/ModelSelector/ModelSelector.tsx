import Input from '@plitzi/plitzi-ui/Input';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import ModelOption from './components/ModelOption';

import type { AiModelInfo } from '@pmodules/AI/types';

export type ModelSelectorProps = {
  models: AiModelInfo[];
  currentModel?: string;
  modelsLoading?: boolean;
  disabled?: boolean;
  onChange: (modelId: string) => void;
};

const ModelSelector = ({
  models,
  currentModel,
  modelsLoading = false,
  disabled = false,
  onChange
}: ModelSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const toggle = useCallback(() => {
    setOpen(o => {
      if (!o) {
        setQ('');
      }

      return !o;
    });
  }, []);

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

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  const handleSearchChange = useCallback((value: string) => setQ(value), []);

  const handleSelect = useCallback(
    (modelId: string) => {
      onChange(modelId);
      setOpen(false);
    },
    [onChange]
  );

  const lower = q.toLowerCase();
  const filtered = q
    ? models.filter(m => m.name.toLowerCase().includes(lower) || m.id.toLowerCase().includes(lower))
    : models;
  const displayLabel = currentModel?.split('/').pop() ?? 'model';

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={toggle}
        disabled={disabled}
        title="Change model"
        className={clsx(
          'flex items-center gap-1 rounded border border-neutral-300 bg-neutral-100 px-2 py-1 font-mono text-[9.5px] text-zinc-500 transition-colors disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
          {
            'border-neutral-400 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300': open,
            'hover:border-neutral-400 hover:text-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-300': !open
          }
        )}
      >
        <svg className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <span className="max-w-20 truncate font-medium text-zinc-700 dark:text-zinc-300">{displayLabel}</span>
        <svg
          className={clsx(
            'h-2 w-2 shrink-0 text-zinc-400 transition-transform dark:text-zinc-600',
            open && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 z-50 flex w-72 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="shrink-0 border-b border-neutral-100 px-2 py-2 dark:border-zinc-800">
            <Input
              ref={searchRef}
              value={q}
              onChange={handleSearchChange}
              placeholder="Search models…"
              size="xs"
              className="w-full"
              clearable
            >
              <Input.Icon>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                </svg>
              </Input.Icon>
            </Input>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {modelsLoading && (
              <div className="px-3 py-4 text-center font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                Loading…
              </div>
            )}

            {!modelsLoading && !filtered.length && (
              <div className="px-3 py-4 text-center font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                {q ? 'No matches' : 'No models available'}
              </div>
            )}

            {!modelsLoading &&
              filtered.map(m => (
                <ModelOption key={m.id} model={m} isActive={m.id === currentModel} onSelect={handleSelect} />
              ))}
          </div>

          <div className="shrink-0 border-t border-neutral-100 px-2 py-1.5 dark:border-zinc-800">
            <div className="font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
              Configure API keys in <span className="text-zinc-500 dark:text-zinc-500">Settings → Provider</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
