import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Label from '@plitzi/plitzi-ui/Label';
import Select from '@plitzi/plitzi-ui/Select';
import Switch from '@plitzi/plitzi-ui/Switch';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useMemo, useState } from 'react';

import { actionTriggers, triggerInput } from '@plitzi/sdk-shared/actions';

import type { ActionDocument, ActionRunReport, ActionTriggerType } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type ActionTestRunProps = {
  /** The stored document — runs execute it, not unsaved form edits. */
  document: ActionDocument;
  disabled: boolean;
  disabledReason?: string;
  onRun: (input: Record<string, unknown>, trigger: ActionTriggerType) => Promise<ActionRunReport | undefined>;
};

const statusIntent = (status: string) => (status === 'completed' ? 'success' : 'error');

const TRIGGER_TITLES: Record<string, string> = {
  call: 'As a page calling it',
  webhook: 'As an inbound webhook',
  schedule: 'As its schedule firing now',
  render: 'As a page rendering',
  custom: 'As the trigger this deployment mounts'
};

const failureOf = (result: unknown): string => {
  if (typeof result === 'string') {
    return result;
  }

  const error = (result as { error?: unknown } | undefined)?.error;

  return typeof error === 'string' ? error : '';
};

const ActionTestRun = ({ document, disabled, disabledReason, onRun }: ActionTestRunProps) => {
  const triggers = useMemo(
    () => actionTriggers(document).filter(node => node.action) as { id: string; action: string; params: object }[],
    [document]
  );
  const [trigger, setTrigger] = useState<string>(() => triggers[0]?.action ?? 'call');
  const [values, setValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState('{}');
  const [report, setReport] = useState<ActionRunReport | undefined>(undefined);
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const selected = useMemo<(typeof triggers)[number] | undefined>(
    () => triggers.find(node => node.action === trigger) ?? triggers[0],
    [triggers, trigger]
  );
  const input = useMemo(() => (selected ? triggerInput(selected.params) : {}), [selected]);

  const handleChange = useCallback(
    (key: string) => (value: string) => setValues(current => ({ ...current, [key]: value })),
    []
  );

  // Values stay strings: the server coerces each to its declared type.
  const handleChangeSwitch = useCallback(
    (key: string) => (e: ChangeEvent<HTMLInputElement>) =>
      setValues(current => ({ ...current, [key]: e.target.checked ? 'true' : 'false' })),
    []
  );

  const handleChangeTrigger = useCallback((value: string) => {
    setTrigger(value);
    setReport(undefined);
    setError('');
  }, []);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError('');
    try {
      // Sent exactly as an endpoint delivers it: body keys plus the whole body under payload.
      if (trigger === 'webhook') {
        const parsed: unknown = JSON.parse(body || '{}');
        const payload = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
        setReport(await onRun({ ...payload, payload }, 'webhook'));

        return;
      }

      setReport(await onRun(values, trigger as ActionTriggerType));
    } catch (err: unknown) {
      setReport(undefined);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [body, onRun, trigger, values]);

  const fields = Object.entries(input);

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-gray-300 p-3 dark:border-zinc-600">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Test run</span>
        <Button size="xs" disabled={disabled || isRunning || !selected} onClick={handleRun}>
          {isRunning ? 'Running…' : 'Run'}
        </Button>
      </div>
      {disabled && disabledReason && <span className="text-xs text-gray-500">{disabledReason}</span>}
      {triggers.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          This action has no way in yet. Add a trigger step to the flow — that is what decides who may start it and what
          they may send.
        </span>
      )}
      {triggers.length > 1 && (
        <Select value={trigger} label="Start it" size="xs" onChange={handleChangeTrigger}>
          {triggers.map(node => (
            <option key={node.id} value={node.action}>
              {TRIGGER_TITLES[node.action] ?? node.action}
            </option>
          ))}
        </Select>
      )}
      {trigger === 'webhook' && (
        <div className="flex flex-col gap-1">
          <Label size="xs">Delivery body (JSON)</Label>
          <TextArea className="w-full font-mono" size="xs" value={body} placeholder="{ }" onChange={setBody} />
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            The signature is not checked here — there is no sender to sign with. Whether it WOULD verify is what the
            check above answers.
          </span>
        </div>
      )}
      {trigger !== 'webhook' && fields.length > 0 && (
        <div className="flex flex-col gap-2">
          {fields.map(([key, field]) => (
            <div key={key} className="flex flex-col gap-1">
              <Label size="xs">
                {field.label ?? key}
                {field.required ? ' *' : ''}
              </Label>
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
                  {failure && <span className="mt-1 wrap-break-word text-red-600 dark:text-red-400">{failure}</span>}
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
