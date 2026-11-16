import { useCallback, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import AccessPicker from './AccessPicker';

import type { SpaceCredential, SpaceTarget } from '@plitzi/sdk-shared';

export type OwnAddressCardProps = {
  target: SpaceTarget;
  /** The password it asks for now, by identifier: none, everybody sees it. */
  access: string;
  passwords: readonly SpaceCredential[];
  onChanged: () => Promise<void>;
};

/**
 * The space's own address, said for what it is: live with every save, nothing to publish there. Who may see it is the
 * one thing to choose, and it applies at once — there is no publish for it to wait for.
 */
const OwnAddressCard = ({ target, access, passwords, onChanged }: OwnAddressCardProps) => {
  const { mutate } = useBuilderNetwork();
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<{ tone: 'ok' | 'error'; words: string }>();

  const handleChangeAccess = useCallback(
    async (identifier: string) => {
      setSaving(true);
      setSaid(undefined);
      // The address shows the draft: its access is written with it, as every domain's is with what it serves.
      const response = await mutate(
        'SpaceDeploy',
        { environment: 'main', domain: target.domain, revision: 0, credentialIdentifier: identifier },
        true
      );
      setSaving(false);
      if (!response.result) {
        setSaid({
          tone: 'error',
          words: response.error instanceof Error ? response.error.message : 'Its access was not changed.'
        });

        return;
      }

      await onChanged();
      const password = passwords.find(each => each.identifier === identifier);
      setSaid({
        tone: 'ok',
        words: password ? `It asks for ${password.name} now.` : 'Everybody can see it now.'
      });
    },
    [mutate, onChanged, passwords, target.domain]
  );

  return (
    <section
      aria-label="Your Plitzi address"
      className="border-ui-line bg-ui-raised flex flex-col gap-2.5 rounded-lg border p-3"
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary-500/15 text-primary-600 dark:text-primary-300 flex size-8 shrink-0 items-center justify-center rounded-md">
          <i className="fa-solid fa-globe" aria-hidden />
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-ui-fg truncate text-sm font-semibold">{target.domain}</span>
          <span className="text-ui-fg-subtle text-xs">
            Your Plitzi address. It shows every change as soon as you save it — there is nothing to publish here.
          </span>
        </span>
        <a
          href={`https://${target.domain}`}
          target="_blank"
          rel="noreferrer noopener"
          className="border-ui-line bg-ui-panel text-ui-fg hover:bg-ui-hover inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium"
        >
          Open
          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden />
        </a>
      </div>
      <AccessPicker value={access} passwords={passwords} disabled={saving} onChange={handleChangeAccess} />
      {saving && <span className="text-ui-fg-subtle text-xs">Saving…</span>}
      {said && (
        <span
          role={said.tone === 'error' ? 'alert' : 'status'}
          className={said.tone === 'error' ? 'text-xs text-red-700 dark:text-red-300' : 'text-ui-fg-subtle text-xs'}
        >
          {said.words}
        </span>
      )}
    </section>
  );
};

export default OwnAddressCard;
