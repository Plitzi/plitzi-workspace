import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import Notice from '../../components/Notice';

import type { SpaceTarget } from '@plitzi/sdk-shared';

export type TargetAutomationProps = {
  target: SpaceTarget;
  /** The plan that includes it, when the space's does not. */
  lockedBy: string | undefined;
  onChanged: () => void;
};

const errorOf = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'It was not changed';

/**
 * What runs a target without a person at the builder (RFC 0034 §8): protected — only whoever manages the space moves
 * it — and a deploy hook, a secret address a CI calls as its last step, shown the once it is made.
 */
const TargetAutomation = ({ target, lockedBy, onChanged }: TargetAutomationProps) => {
  const { mutate } = useBuilderNetwork();
  const [hookUrl, setHookUrl] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  const change = useCallback(
    async (asked: { protected?: boolean; hook?: 'create' | 'remove' }) => {
      setBusy(true);
      setProblem(undefined);
      const response = await mutate('SpaceTargetAutomation', { domain: target.domain, ...asked }, true);
      setBusy(false);
      if (!response.result) {
        setProblem(errorOf(response.error));

        return;
      }

      const { hook } = response.result;
      setHookUrl(hook && 'url' in hook ? hook.url : undefined);
      onChanged();
    },
    [mutate, onChanged, target.domain]
  );

  return (
    <section aria-label="Automation" className="border-ui-line flex flex-col gap-2 border-t pt-3">
      <span className="text-ui-fg-subtle text-[11px] font-bold tracking-wider uppercase">
        Automation{lockedBy ? ` · ${lockedBy} plan` : ''}
      </span>
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={target.protected}
          disabled={busy || (lockedBy !== undefined && !target.protected)}
          onChange={event => void change({ protected: event.target.checked })}
        />
        <span className="flex flex-col">
          <span className="text-ui-fg font-medium">Protected</span>
          <span className="text-ui-fg-subtle">
            Only whoever manages the space publishes here, deploys it or rolls it back.
          </span>
        </span>
      </label>
      {target.mode !== 'ssr' && (
        <div className="flex flex-col gap-1.5 text-xs">
          <span className="flex items-center justify-between gap-2">
            <span className="flex flex-col">
              <span className="text-ui-fg font-medium">Deploy hook</span>
              <span className="text-ui-fg-subtle">
                {target.hook
                  ? 'A secret address deploys it when called — a CI’s last step.'
                  : 'A secret address a CI calls to deploy it, or ?publish=latest to publish the newest snapshot first.'}
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              {target.hook && (
                <Button size="xs" intent="secondary" disabled={busy} onClick={() => void change({ hook: 'remove' })}>
                  Remove
                </Button>
              )}
              <Button
                size="xs"
                intent="secondary"
                disabled={busy || lockedBy !== undefined}
                onClick={() => void change({ hook: 'create' })}
              >
                {target.hook ? 'Make a new one' : 'Make one'}
              </Button>
            </span>
          </span>
          {hookUrl && (
            <Notice tone="caution">
              <span className="flex flex-col gap-1">
                <span>Copy it now — it is shown this once. Call it with POST:</span>
                <code className="bg-ui-raised rounded px-1.5 py-1 font-mono text-[11px] break-all select-all">
                  {hookUrl}
                </code>
              </span>
            </Notice>
          )}
        </div>
      )}
      {problem && <Notice tone="danger">{problem}</Notice>}
    </section>
  );
};

export default TargetAutomation;
