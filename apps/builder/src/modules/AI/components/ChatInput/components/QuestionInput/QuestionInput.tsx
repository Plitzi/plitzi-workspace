import Button from '@plitzi/plitzi-ui/Button';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
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
  const hasAnyOptions = useMemo(() => questions.some(q => (q.options?.length ?? 0) > 0), [questions]);
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const [custom, setCustom] = useState('');
  // Free-form questions (no options) show the input directly; otherwise it stays hidden behind "Other".
  const [showCustom, setShowCustom] = useState(!hasAnyOptions);

  const single = questions.length === 1 && !questions[0].multiSelect;
  const allSelected = useMemo(() => questions.every((_, i) => (selected[i] ?? []).length > 0), [questions, selected]);

  const toggle = useCallback((qIndex: number, value: string, multi: boolean) => {
    setSelected(prev => {
      const current = prev[qIndex] ?? [];
      if (!multi) {
        return { ...prev, [qIndex]: [value] };
      }

      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];

      return { ...prev, [qIndex]: next };
    });
  }, []);

  const buildAnswer = useCallback((): string => {
    const trimmed = custom.trim();
    const lines = questions
      .map((q, i) => {
        const vals = selected[i] ?? [];

        return vals.length > 0 ? `${q.question}: ${vals.join(', ')}` : '';
      })
      .filter(Boolean);

    if (lines.length === 1 && questions.length === 1 && !trimmed) {
      const vals = (selected[0] as string[] | undefined) ?? [];

      return vals.length === 1 ? vals[0] : lines[0];
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

    return allSelected;
  }, [allSelected, custom]);

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

  // Empty input losing focus → the user changed their mind, collapse it back to the "Other…" option.
  const handleBlur = useCallback(() => {
    if (!custom.trim() && hasAnyOptions) {
      setShowCustom(false);
    }
  }, [custom, hasAnyOptions]);

  return (
    <div className="border-t border-neutral-300 bg-neutral-100 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="overflow-hidden rounded-xl border border-violet-300/60 bg-white shadow-sm dark:border-violet-500/30 dark:bg-zinc-950">
        <div className="flex items-center gap-1.5 border-b border-neutral-200 px-3 py-1.5 dark:border-zinc-800">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-linear-to-br from-pink-500 to-sky-500" />
          <span className="font-mono text-[10px] font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            {questions.length > 1 ? `${questions.length} questions` : 'Needs your input'}
          </span>
        </div>

        <div className="flex flex-col gap-3 px-3 py-2.5">
          {questions.map((q, i) => {
            const values = selected[i] ?? [];

            return (
              <div key={`${i}-${q.question}`} className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-1.5">
                  {questions.length > 1 && (
                    <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">{i + 1}.</span>
                  )}
                  <p className="text-[13px] leading-snug font-medium text-zinc-800 dark:text-zinc-100">{q.question}</p>
                  {q.multiSelect && (
                    <span className="font-mono text-[9px] tracking-wide text-zinc-400 dark:text-zinc-600">
                      select all that apply
                    </span>
                  )}
                </div>

                {q.multiSelect && q.options && q.options.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {q.options.map(option => {
                      const value = optionValue(option);

                      return (
                        <Checkbox
                          key={value}
                          label={option.label}
                          checked={values.includes(value)}
                          disabled={disabled}
                          size="sm"
                          onChange={() => toggle(i, value, true)}
                        />
                      );
                    })}
                  </div>
                )}

                {!q.multiSelect && q.options && q.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map(option => {
                      const value = optionValue(option);

                      return (
                        <Button
                          key={value}
                          type="button"
                          size="xs"
                          intent={values.includes(value) ? 'primary' : 'secondary'}
                          disabled={disabled}
                          onClick={() => handleOptionClick(i, value, false)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {!showCustom && (
            <div className="flex items-center gap-2 pt-0.5">
              <Button type="button" size="xs" intent="secondary" disabled={disabled} onClick={() => setShowCustom(true)}>
                Other…
              </Button>
              {!single && (
                <div className="ml-auto">
                  <Button
                    type="button"
                    size="sm"
                    intent="primary"
                    disabled={disabled || !allSelected}
                    onClick={handleSubmit}
                  >
                    Send
                  </Button>
                </div>
              )}
            </div>
          )}

          {showCustom && (
            <div className="flex items-center gap-2 pt-0.5">
              <div className="min-w-0 flex-1">
                <Input
                  value={custom}
                  disabled={disabled}
                  autoFocus
                  size="sm"
                  placeholder="Type your answer…"
                  onChange={setCustom}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                />
              </div>
              <Button
                type="button"
                size="sm"
                intent="primary"
                disabled={disabled || !canSubmit}
                onMouseDown={e => e.preventDefault()}
                onClick={handleSubmit}
              >
                Send
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionInput;
