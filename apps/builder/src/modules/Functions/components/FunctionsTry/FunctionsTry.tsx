import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Label from '@plitzi/plitzi-ui/Label';
import Select from '@plitzi/plitzi-ui/Select';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useMemo, useState } from 'react';

import { readParams } from '../../helpers';

import type { ActionRunReport, FunctionTaskManifest } from '@plitzi/sdk-shared';

export type FunctionsTryProps = {
  tasks: FunctionTaskManifest[];
  /** Why it cannot run now — unsaved edits, say — or nothing. */
  disabledReason?: string;
  onTry: (task: string, params: Record<string, unknown>) => Promise<ActionRunReport | undefined>;
};

const nameOf = (task: FunctionTaskManifest) => `${task.namespace}.${task.action}`;

/**
 * One task of the saved draft, run in the sandbox as you — the value it answers, what it logged, how long it took and
 * why it failed. Its fetches and its writes are real, and it counts like any other run.
 */
const FunctionsTry = ({ tasks, disabledReason = '', onTry }: FunctionsTryProps) => {
  const [task, setTask] = useState(() => (tasks[0] ? nameOf(tasks[0]) : ''));
  const [params, setParams] = useState('{}');
  const [report, setReport] = useState<ActionRunReport | undefined>(undefined);
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const step = useMemo(() => report?.steps.find(entry => entry.action === task), [report, task]);

  const handleRun = useCallback(async () => {
    const read = readParams(params);
    if ('error' in read) {
      setError(read.error);

      return;
    }

    setIsRunning(true);
    setError('');
    try {
      setReport(await onTry(task, read.params));
    } catch (err: unknown) {
      setReport(undefined);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [onTry, params, task]);

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-gray-300 p-3 dark:border-zinc-600">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Try</span>
        <Button size="xs" disabled={Boolean(disabledReason) || isRunning || !task} onClick={handleRun}>
          {isRunning ? 'Running…' : 'Run'}
        </Button>
      </div>
      {disabledReason && <span className="text-xs text-gray-500 dark:text-zinc-400">{disabledReason}</span>}
      {tasks.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">Save a task first: its name is what Try runs.</span>
      )}
      {tasks.length > 0 && (
        <Select value={task} label="Task" size="xs" onChange={setTask}>
          {tasks.map(entry => (
            <option key={nameOf(entry)} value={nameOf(entry)}>
              {nameOf(entry)} — {entry.title}
            </option>
          ))}
        </Select>
      )}
      <div className="flex flex-col gap-1">
        <Label size="xs">Params (JSON)</Label>
        <TextArea className="w-full font-mono" size="xs" value={params} placeholder="{ }" onChange={setParams} />
      </div>
      {error && <Alert intent="error">{error}</Alert>}
      {report && (
        <div className="flex flex-col gap-1 text-xs">
          <span
            className={
              report.status === 'completed' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }
          >
            {report.status}
            {step && ` in ${String(step.endTime - step.startTime)} ms`}
          </span>
          {step?.logs?.map((line, index) => (
            <code key={`${String(index)} ${line}`} className="text-gray-500 dark:text-zinc-400">
              log {line}
            </code>
          ))}
          {step?.error && <Alert intent="error">{step.error}</Alert>}
          {!step?.error && (
            <pre className="overflow-auto rounded-sm bg-gray-100 p-2 dark:bg-zinc-800">
              {JSON.stringify(report.output.value ?? null, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default FunctionsTry;
