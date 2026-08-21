import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Label from '@plitzi/plitzi-ui/Label';
import Switch from '@plitzi/plitzi-ui/Switch';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useState } from 'react';

import type { ActionField, ActionRunReport } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type ActionTestRunProps = {
  input: Record<string, ActionField>;
  disabled: boolean;
  disabledReason?: string;
  onRun: (input: Record<string, unknown>) => Promise<ActionRunReport | undefined>;
};

const statusIntent = (status: string) => (status === 'completed' ? 'success' : 'error');

/**
 * What a step left behind, when it is worth reading.
 *
 * Only for a step that did NOT succeed: on a run that worked the results are the flow's own data and belong in
 * the output, while on one that did not this is the answer to the only question being asked — which step stopped
 * it, and what it said. Already redacted of credential values before it left the server.
 */
const failureOf = (result: unknown): string => {
  if (typeof result === 'string') {
    return result;
  }

  const error = (result as { error?: unknown } | undefined)?.error;

  return typeof error === 'string' ? error : '';
};

/**
 * Runs the saved action and shows what happened, step by step.
 *
 * It runs the STORED document, not the form's draft, and says so — a rehearsal of unsaved edits would be a
 * rehearsal of something that does not exist yet, and the run is subject to the same access rule and the same
 * limits a visitor's call is.
 *
 * The trace is the point: a server flow is otherwise a thing that either worked or did not, with the interesting
 * part on a machine the author cannot see.
 */
const ActionTestRun = ({ input, disabled, disabledReason, onRun }: ActionTestRunProps) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [report, setReport] = useState<ActionRunReport | undefined>(undefined);
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleChange = useCallback(
    (key: string) => (value: string) => setValues(current => ({ ...current, [key]: value })),
    []
  );

  // Kept as the string every other control produces: the server coerces the declared type on the way in, and a
  // panel that sent one field differently would be rehearsing a different request.
  const handleChangeSwitch = useCallback(
    (key: string) => (e: ChangeEvent<HTMLInputElement>) =>
      setValues(current => ({ ...current, [key]: e.target.checked ? 'true' : 'false' })),
    []
  );

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError('');
    try {
      setReport(await onRun(values));
    } catch (err: unknown) {
      setReport(undefined);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [onRun, values]);

  const fields = Object.entries(input);

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-gray-300 p-3 dark:border-zinc-600">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Test run</span>
        <Button size="xs" disabled={disabled || isRunning} onClick={handleRun}>
          {isRunning ? 'Running…' : 'Run'}
        </Button>
      </div>
      {disabled && disabledReason && <span className="text-xs text-gray-500">{disabledReason}</span>}
      {fields.length > 0 && (
        <div className="flex flex-col gap-2">
          {fields.map(([key, field]) => (
            <div key={key} className="flex flex-col gap-1">
              <Label size="xs">
                {field.label ?? key}
                {field.required ? ' *' : ''}
              </Label>
              {/* The control the field's own type asks for. A checkbox typed as the word "true" is a test that
                  rehearses a different call from the one a page makes. */}
              {field.type === 'boolean' && (
                <Switch
                  size="xs"
                  checked={values[key] === 'true'}
                  label={field.type}
                  onChange={handleChangeSwitch(key)}
                />
              )}
              {field.type === 'json' && (
                <TextArea
                  className="w-full font-mono"
                  size="xs"
                  value={values[key] ?? ''}
                  placeholder="{ }"
                  onChange={handleChange(key)}
                />
              )}
              {field.type !== 'boolean' && field.type !== 'json' && (
                <Input value={values[key] ?? ''} size="xs" placeholder={field.type} onChange={handleChange(key)} />
              )}
            </div>
          ))}
        </div>
      )}
      {error && (
        <Alert intent="error" size="sm">
          <span className="text-xs">{error}</span>
        </Alert>
      )}
      {report && (
        <div className="flex flex-col gap-2">
          <Alert intent={statusIntent(report.status)} size="sm">
            <span className="text-xs">
              {report.status} — {JSON.stringify(report.output)}
            </span>
          </Alert>
          <div className="flex flex-col gap-1">
            {report.trace.map((step, index) => {
              const node = step.node as { title?: string; action?: string } | undefined;
              const failure = step.status === 'success' ? '' : failureOf(step.result);

              return (
                <div
                  key={`${String(node?.action)}-${index}`}
                  className="flex flex-col rounded-sm border border-gray-200 px-2 py-1 text-xs dark:border-zinc-700"
                >
                  <div className="flex items-center justify-between">
                    <span>{node?.title ?? node?.action ?? 'step'}</span>
                    <span className="text-gray-500">{String(step.status)}</span>
                  </div>
                  {/* The whole point of showing a trace: a run that failed says WHERE, and this says why. */}
                  {failure && <span className="mt-1 break-words text-red-600 dark:text-red-400">{failure}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionTestRun;
