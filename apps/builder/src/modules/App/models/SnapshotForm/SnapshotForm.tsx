import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useCallback, useRef } from 'react';
import { z } from 'zod';

import useSpaceEntitlements from '@pmodules/Space/hooks/useSpaceEntitlements';
import useSpaceIssues from '@pmodules/Space/hooks/useSpaceIssues';

import ChangesSummary, { useVersionChanges } from '../../components/ChangesSummary';
import EnvironmentSegments from '../../components/EnvironmentSegments';
import SnapshotPruneNotice from '../../components/SnapshotPruneNotice';
import VersionContents from '../../components/VersionContents';
import { PUBLISHED_ENVIRONMENTS, revisionName } from '../../helpers/environments';
import useLatestSnapshots, { latestDetail } from '../../hooks/useLatestSnapshots';

import type { PublishedEnvironment } from '../../helpers/environments';
import type { MouseEvent } from 'react';

const snapshotFormSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  description: z.string().max(200, { message: 'At most 200 characters' })
});

export type SnapshotFormValues = z.infer<typeof snapshotFormSchema> & {
  /** Pressed "Snapshot and publish…": the publish sheet opens next, on this snapshot. */
  thenPublish: boolean;
};

export type SnapshotFormProps = {
  environment?: PublishedEnvironment;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: SnapshotFormValues) => void;
};

/** Cancel beside the actions, as quiet as a link: the action is what the footer is for. */
const QUIET_BUTTON = 'border-transparent bg-transparent text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover';

/**
 * Make a snapshot: which environment it goes to, what it changes against that environment's latest, what it is for —
 * and only the notices that apply. One primary: snapshot and go on to publish it; snapshot alone stays beside it.
 */
const SnapshotForm = ({ environment, onClose, onSubmit }: SnapshotFormProps) => {
  // An environment the space's plan does not include is shown, and locked with the plan that does.
  const { locked } = useSpaceEntitlements();
  const { byEnvironment } = useLatestSnapshots();
  const { issues } = useSpaceIssues();
  const first = environment ?? PUBLISHED_ENVIRONMENTS.find(value => !locked(value)) ?? 'production';
  const form = useForm({
    defaultValues: { environment: first, description: '' },
    config: { schema: snapshotFormSchema }
  });
  const chosen = useFormWatch(form.formMethods, 'environment');
  const latest = byEnvironment[chosen];
  const { changes, loading } = useVersionChanges(
    latest ? { environment: chosen, revision: latest.revision } : undefined,
    { environment: 'main' }
  );
  const thenPublish = useRef(false);
  const warnings = issues?.warnings.length ?? 0;

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof snapshotFormSchema>) =>
      onSubmit?.(undefined, { ...values, thenPublish: thenPublish.current }),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body className="gap-4">
        <p className="text-ui-fg-subtle text-sm">
          Freeze the draft as a revision you can publish, compare or roll back to. Nothing a visitor sees changes yet.
        </p>
        <Form.Custom
          name="environment"
          render={({ field: { value, onChange } }) => (
            <EnvironmentSegments
              label="Environment"
              value={value as PublishedEnvironment}
              onChange={onChange}
              segments={PUBLISHED_ENVIRONMENTS.map(env => ({
                value: env,
                detail: latestDetail(byEnvironment[env]),
                lockedBy: locked(env)?.requires
              }))}
            />
          )}
        />
        {latest ? (
          <ChangesSummary
            title={`What changes since ${revisionName(chosen, latest.revision)}`}
            changes={changes}
            loading={loading}
          />
        ) : (
          <VersionContents environment="main" title={`The first snapshot of ${chosen} will freeze`} />
        )}
        <Form.TextArea
          name="description"
          label="Description"
          placeholder="What it is for — e.g. Spring menu, the new booking form"
          size="sm"
        />
        <ul className="text-ui-fg-subtle flex flex-col gap-1 text-xs">
          <li className="flex items-center gap-1.5">
            <i className="fa-solid fa-flask-vial w-3.5 text-center" />
            The space’s tests run as it is taken; one that fails keeps it from being taken.
          </li>
          {warnings > 0 && (
            <li className="flex items-center gap-1.5">
              <i className="fa-solid fa-triangle-exclamation w-3.5 text-center text-amber-500" />
              {warnings === 1 ? '1 issue' : `${String(warnings)} issues`} in Space Issues — they do not stop a snapshot.
            </li>
          )}
          <li>
            <details>
              <summary className="hover:text-ui-fg flex w-fit cursor-pointer items-center gap-1.5">
                <i className="fa-solid fa-flag w-3.5 text-center" />
                Feature flags go to the environment, not into the snapshot
              </summary>
              <p className="mt-1 pl-5">
                This snapshot sends the draft’s flags to {chosen} and keeps a copy only as a fallback. Rolling back to
                an older snapshot later keeps the environment’s flags as they are.
              </p>
            </details>
          </li>
        </ul>
        <SnapshotPruneNotice environment={chosen} />
      </Form.Body>
      <Form.Footer justify="end" className="gap-2">
        <Button onClick={onClose} size="sm" intent="custom" className={QUIET_BUTTON}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          intent="secondary"
          onClick={() => {
            thenPublish.current = false;
          }}
        >
          Snapshot
        </Button>
        <Button
          type="submit"
          size="sm"
          onClick={() => {
            thenPublish.current = true;
          }}
        >
          Snapshot and publish…
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default SnapshotForm;
