import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useMemo, useState } from 'react';

import { paramDefaults, readParams, runLabel, taskNameOf } from '../../../../helpers';
import TryField from '../TryField';
import TryResult from '../TryResult';

import type { ListedTask } from '../../../../helpers';
import type { ActionRunReport } from '@plitzi/sdk-shared';

export type TaskTestProps = {
  /** The task under test. The form starts again from its defaults whenever it changes: give it a `key` of it. */
  task: ListedTask;
  /** The code differs from the saved draft — or the task is not in it yet — so a run saves first. */
  needsSave: boolean;
  /** Runs it in the sandbox as you, saving first when it has to; throws why it could not. */
  onRun: (task: string, params: Record<string, unknown>) => Promise<ActionRunReport | undefined>;
};

/**
 * The task run in the sandbox as you — its params filled in as its step would fill them, or as JSON — and what it
 * answered: the value, what it logged, how long it took and why it failed. Its fetches and its writes are real.
 */
const TaskTest = ({ task, needsSave, onRun }: TaskTestProps) => {
  const name = taskNameOf(task);
  const [values, setValues] = useState<Record<string, unknown>>(() => paramDefaults(task));
  const [json, setJson] = useState<string | undefined>(undefined);
  const [report, setReport] = useState<ActionRunReport | undefined>(undefined);
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const params = useMemo(() => Object.entries(task.params), [task.params]);

  const handleChange = useCallback((param: string, value: unknown) => {
    setValues(state => ({ ...state, [param]: value }));
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
      setReport(await onRun(name, read.params));
    } catch (err: unknown) {
      setReport(undefined);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [json, name, onRun, values]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-300">Params</span>
          <button
            type="button"
            className="text-[11px] text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={handleToggleJson}
          >
            {json === undefined ? 'Edit as JSON' : 'Edit as form'}
          </button>
        </div>
        {json === undefined && params.length === 0 && (
          <span className="text-xs text-gray-500 dark:text-zinc-400">This task takes none.</span>
        )}
        {json === undefined &&
          params.map(([param, spec]) => (
            <TryField key={param} name={param} param={spec} value={values[param]} onChange={handleChange} />
          ))}
        {json !== undefined && (
          <TextArea className="w-full font-mono" size="xs" value={json} placeholder="{ }" onChange={setJson} />
        )}
      </div>
      <Button
        size="sm"
        iconPlacement="before"
        disabled={isRunning}
        title={needsSave ? 'Saves your changes, then runs the saved draft' : 'Runs the saved draft'}
        onClick={handleRun}
      >
        <i className={isRunning ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-play'} />
        {runLabel(isRunning, needsSave)}
      </Button>
      {error && (
        <Alert intent="error" size="xs" solid={false}>
          {error}
        </Alert>
      )}
      {report && <TryResult report={report} task={name} />}
    </div>
  );
};

export default TaskTest;
