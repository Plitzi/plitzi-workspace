import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import type { AiQuestion } from './helpers';
import type { KeyboardEvent } from 'react';

export type QuestionInputProps = {
  questions: AiQuestion[];
  disabled?: boolean;
  onSubmit: (answer: string) => void;
};

const optionValue = (option: { label: string; value?: string }) => option.value ?? option.label;

const QuestionInput = ({ questions, disabled = false, onSubmit }: QuestionInputProps) => {
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const [custom, setCustom] = useState('');

  const single = questions.length === 1 && !questions[0].multiSelect;

  const toggle = useCallback(
    (qIndex: number, value: string, multi: boolean) => {
      setSelected(prev => {
        const current = prev[qIndex] ?? [];
        if (!multi) {
          return { ...prev, [qIndex]: [value] };
        }

        const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];

        return { ...prev, [qIndex]: next };
      });
    },
    [setSelected]
  );

  const buildAnswer = useCallback((): string => {
    const trimmed = custom.trim();
    const lines = questions
      .map((q, i) => {
        const vals = selected[i] ?? [];

        return vals.length > 0 ? `${q.question}: ${vals.join(', ')}` : '';
      })
      .filter(Boolean);

    if (lines.length === 1 && questions.length === 1 && !trimmed) {
      const onlyValue = ((selected[0] as string[] | undefined) ?? [])[0];

      return onlyValue ? onlyValue : lines[0];
    }

    if (trimmed) {
      lines.push(trimmed);
    }

    return lines.join('\n');
  }, [questions, selected, custom]);

  const canSubmit = useMemo(() => {
    if (custom.trim()) {
      return true;
    }

    return questions.every((_, i) => (selected[i] ?? []).length > 0);
  }, [questions, selected, custom]);

  const handleSubmit = useCallback(() => {
    const answer = buildAnswer();
    if (!answer.trim()) {
      return;
    }

    onSubmit(answer);
  }, [buildAnswer, onSubmit]);

  const handleOptionClick = useCallback(
    (qIndex: number, value: string, multi: boolean) => {
      if (single) {
        onSubmit(value);

        return;
      }

      toggle(qIndex, value, multi);
    },
    [single, onSubmit, toggle]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-300 bg-neutral-100 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
      {questions.map((q, i) => (
        <div key={`${i}-${q.question}`} className="flex flex-col gap-1.5">
          <p className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200">{q.question}</p>
          {q.options && q.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map(option => {
                const value = optionValue(option);
                const active = (selected[i] ?? []).includes(value);

                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleOptionClick(i, value, !!q.multiSelect)}
                    className={clsx(
                      'rounded border px-2.5 py-1 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                      active
                        ? 'border-violet-500 bg-violet-600 text-white dark:border-violet-400 dark:bg-violet-500'
                        : 'border-zinc-300 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={custom}
          disabled={disabled}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Other — type your answer…"
          className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-[12.5px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="button"
          disabled={disabled || !canSubmit}
          onClick={handleSubmit}
          className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-violet-500"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default QuestionInput;
