import useDisclosure from '@plitzi/plitzi-ui/hooks/useDisclosure';
import Input from '@plitzi/plitzi-ui/Input';
import Modal from '@plitzi/plitzi-ui/Modal';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import KeyboardKey from '@pmodules/AI/components/KeyboardKey';

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
  const [filter, setFilter] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleModalClose = useCallback(() => {
    setFilter('');
  }, []);

  const [id, open, onOpen, onClose] = useDisclosure({ onClose: handleModalClose });

  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        onOpen();
      }
    };

    const handlerKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        // setHighlighted(h => Math.min(h + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        // setHighlighted(h => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // const item = flatList.at(highlighted);
        // if (item) {
        // onChange(item.id);
        // }
      } else if (/^[1-9]$/.test(e.key) && (e.metaKey || e.ctrlKey)) {
        // e.preventDefault();
        // const item = flatList.at(parseInt(e.key, 10) - 1);
        // if (item) {
        //   onChange(item.id);
        // }
      }
    };

    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handlerKeyboard);

    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handlerKeyboard);
    };
  }, [onClose, onOpen, open]);

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  const handleSearchChange = useCallback((value: string) => setFilter(value), []);

  const handleSelect = useCallback(
    (modelId: string) => {
      onChange(modelId);
      onOpen();
    },
    [onChange, onOpen]
  );

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const lower = filter.toLowerCase();
  const filtered = filter
    ? models.filter(m => m.name.toLowerCase().includes(lower) || m.id.toLowerCase().includes(lower))
    : models;
  const displayLabel = currentModel?.split('/').pop() ?? 'model';

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={onOpen}
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
      </button>

      <Modal onClick={handleClick} onClose={onClose} id={id} open={open} size="sm" className={{ card: 'w-145' }}>
        <Modal.Header>
          <Modal.HeaderIcon>
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </Modal.HeaderIcon>
          Models Available
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="shrink-0 border-b border-neutral-100 px-2 py-2 dark:border-zinc-800">
            <Input
              ref={searchRef}
              value={filter}
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

          <div className="h-75 overflow-y-auto">
            {modelsLoading && (
              <div className="px-3 py-4 text-center font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                Loading…
              </div>
            )}

            {!modelsLoading && !filtered.length && (
              <div className="px-3 py-4 text-center font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                {filter ? 'No matches' : 'No models available'}
              </div>
            )}

            {!modelsLoading &&
              filtered.map(m => (
                <ModelOption key={m.id} model={m} isActive={m.id === currentModel} onSelect={handleSelect} />
              ))}
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-neutral-100 px-2 py-1.5 dark:border-zinc-700">
            <div className="flex items-center gap-3 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
              <span className="flex items-center gap-1">
                <KeyboardKey char="↑" commandChar={false} />
                <KeyboardKey char="↓" commandChar={false} />
                navigate
              </span>
              <span className="flex items-center gap-1">
                <KeyboardKey char="↵" commandChar={false} />
                select
              </span>
              <span className="flex items-center gap-1">
                <KeyboardKey char="esc" commandChar={false} />
                close
              </span>
            </div>
            <div className="font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
              Configure API keys in <span className="text-zinc-500 dark:text-zinc-500">Settings → Provider</span>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ModelSelector;
