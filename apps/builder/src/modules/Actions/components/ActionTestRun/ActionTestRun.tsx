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
  /** The STORED document — the one a run would actually execute. */
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
 * Rehearses the action — through whichever way in the author wants to try.
 *
 * It runs the STORED document, not the form's draft, and says so: a rehearsal of unsaved edits would be a
 * rehearsal of something that does not exist yet. It goes through the same runner a visitor's call goes through,
 * so the trigger's own access rule, the input contract and every limit apply.
 *
 * Being able to pick the trigger is the point. A page call is the one an author can already try by clicking the
 * page; a **webhook** and a **schedule** are the ones nobody is watching, that fail at 3am on somebody else's
 * delivery — and until this existed the only way to find out that a credential was wrong was to wait for one.
 */
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

  // Undefined when the action has no way in at all, which is a document somebody is still writing.
  const selected = useMemo<(typeof triggers)[number] | undefined>(
    () => triggers.find(node => node.action === trigger) ?? triggers[0],
    [triggers, trigger]
  );
  const input = useMemo(() => (selected ? triggerInput(selected.params) : {}), [selected]);

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

  const handleChangeTrigger = useCallback((value: string) => {
    setTrigger(value);
    setReport(undefined);
    setError('');
  }, []);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError('');
    try {
      /**
       * A webhook is fed its BODY, exactly as the endpoint feeds it: the body's own keys, plus the whole thing
       * under `payload`. Sending the declared fields instead would rehearse a shape no sender produces.
       *
       * What this cannot rehearse is the signature, because there is no sender to sign with — that is what the
       * check above answers instead.
       */
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
