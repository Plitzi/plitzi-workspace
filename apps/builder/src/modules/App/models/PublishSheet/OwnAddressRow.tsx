import { useCallback, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import AccessPicker from './AccessPicker';

import type { SpaceCredential, SpaceTarget } from '@plitzi/sdk-shared';

export type OwnAddressRowProps = {
  target: SpaceTarget;
  /** The password it asks for now, by identifier: none, everybody sees it. */
  access: string;
  passwords: readonly SpaceCredential[];
  onChanged: () => Promise<void>;
};

/**
 * The space's own address, first in the list of where the site is and said for what it is: always the latest saved
 * edits, nothing to publish — so never chosen to publish to. Who may see it applies at once, beside it.
 */
const OwnAddressRow = ({ target, access, passwords, onChanged }: OwnAddressRowProps) => {
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
        { environment: 'main', domain: target.domain, credentialIdentifier: identifier },
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
      setSaid({ tone: 'ok', words: password ? `It asks for ${password.name} now.` : 'Everybody can see it now.' });
    },
    [mutate, onChanged, passwords, target.domain]
  );
  const handleAccess = useCallback((identifier: string) => void handleChangeAccess(identifier), [handleChangeAccess]);

  return (
    <li className="flex flex-col gap-1 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="bg-primary-500/15 text-primary-600 dark:text-primary-300 flex size-6 shrink-0 items-center justify-center rounded-md text-xs">
          <i className="fa-solid fa-bolt" aria-hidden />
        </span>
        <span className="flex min-w-0 grow flex-col">
          <span className="text-ui-fg truncate text-sm font-semibold">{target.domain}</span>
          <span className="text-ui-fg-subtle truncate text-xs">
            Your Plitzi address · always your latest saved edits
          </span>
        </span>
        <AccessPicker
          compact
          domain={target.domain}
          value={access}
          passwords={passwords}
          disabled={saving}
          onChange={handleAccess}
        />
        <a
          href={`https://${target.domain}`}
          target="_blank"
          rel="noreferrer noopener"
          title={`Open ${target.domain}`}
          aria-label={`Open ${target.domain}`}
          className="text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover flex size-7 shrink-0 items-center justify-center rounded-md"
        >
          <i className="fa-solid fa-arrow-up-right-from-square text-xs" aria-hidden />
        </a>
      </div>
      {said && (
        <span
          role={said.tone === 'error' ? 'alert' : 'status'}
          className={
            said.tone === 'error' ? 'pl-8.5 text-xs text-red-700 dark:text-red-300' : 'text-ui-fg-subtle pl-8.5 text-xs'
          }
        >
          {said.words}
        </span>
      )}
    </li>
  );
};

export default OwnAddressRow;
