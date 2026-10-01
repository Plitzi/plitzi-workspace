import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Select from '@plitzi/plitzi-ui/Select';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useMemo, useState } from 'react';

import TryField from './components/TryField';
import TryResult from './components/TryResult';
import { paramDefaults, readParams, taskNameOf } from '../../helpers';

import type { ActionRunReport, FunctionTaskManifest } from '@plitzi/sdk-shared';

export type FunctionsTryProps = {
  tasks: FunctionTaskManifest[];
  /** The task being tried. The form starts again from its defaults whenever it changes: give it a `key` of it. */
  task: string;
  onTaskChange: (task: string) => void;
  /** Why it cannot run now — unsaved edits, say — or nothing. */
  disabledReason?: string;
  onTry: (task: string, params: Record<string, unknown>) => Promise<ActionRunReport | undefined>;
};

/**
 * One task of the saved draft, run in the sandbox as you — its params filled in as its step would fill them, or as
 * JSON — and what it answers: the value, what it logged, how long it took and why it failed. Its fetches and its
 * writes are real, and it counts like any other run.
 */
const FunctionsTry = ({ tasks, task, onTaskChange, disabledReason = '', onTry }: FunctionsTryProps) => {
  const current = useMemo(() => tasks.find(entry => taskNameOf(entry) === task), [task, tasks]);
  const [values, setValues] = useState<Record<string, unknown>>(() => paramDefaults(current));
  const [json, setJson] = useState<string | undefined>(undefined);
  const [report, setReport] = useState<ActionRunReport | undefined>(undefined);
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const params = useMemo(() => Object.entries(current?.params ?? {}), [current]);

  const handleChange = useCallback((name: string, value: unknown) => {
    setValues(state => ({ ...state, [name]: value }));
  }, []);

  // Between the form and JSON: what is in one is what the other opens with.
  const handleToggleJson = useCallback(() => {
    if (json === undefined) {
      setJson(JSON.stringify(values, null, 2));

      return;
    }

    const read = readParams(json);
    if ('error' in read) {
      setError(read.error);

      return;
    }

    setValues(read.params);
    setJson(undefined);
    setError('');
  }, [json, values]);

  const handleRun = useCallback(async () => {
    const read = json === undefined ? { params: values } : readParams(json);
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
  }, [json, onTry, task, values]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-400">Try</span>
        <Button size="xs" disabled={Boolean(disabledReason) || isRunning || !current} onClick={handleRun}>
          <i className="fa-solid fa-play mr-1" />
          {isRunning ? 'Running…' : 'Run'}
        </Button>
      </div>
      {disabledReason && <span className="text-xs text-amber-700 dark:text-amber-400">{disabledReason}</span>}
      {tasks.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">Save a task first: its name is what Try runs.</span>
      )}
      {tasks.length > 0 && (
        <Select value={task} label="Task" size="xs" onChange={onTaskChange}>
          {tasks.map(entry => (
            <option key={taskNameOf(entry)} value={taskNameOf(entry)}>
              {entry.title} — {taskNameOf(entry)}
            </option>
          ))}
        </Select>
      )}
      {current && (
        <div className="flex flex-col gap-2 rounded-sm border border-gray-200 p-2 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500 dark:text-zinc-400">Params</span>
            <Button size="xs" intent="secondary" onClick={handleToggleJson}>
              {json === undefined ? 'JSON' : 'Form'}
            </Button>
          </div>
          {json === undefined && params.length === 0 && (
            <span className="text-xs text-gray-500 dark:text-zinc-400">This task takes none.</span>
          )}
          {json === undefined &&
            params.map(([name, param]) => (
              <TryField key={name} name={name} param={param} value={values[name]} onChange={handleChange} />
            ))}
          {json !== undefined && (
            <TextArea className="w-full font-mono" size="xs" value={json} placeholder="{ }" onChange={setJson} />
          )}
        </div>
      )}
      {error && (
        <Alert intent="error" size="xs" solid={false}>
          {error}
        </Alert>
      )}
      {report && <TryResult report={report} task={task} />}
    </div>
  );
};

export default FunctionsTry;
