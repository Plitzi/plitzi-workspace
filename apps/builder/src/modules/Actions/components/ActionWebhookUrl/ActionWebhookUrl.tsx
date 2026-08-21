import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useState } from 'react';

export type ActionWebhookUrlProps = {
  identifier: string;
  deployments: { environment: string; domain: string; isDefault: boolean }[];
};

/**
 * The URL a sender has to be given, spelled out.
 *
 * It is not a property of the action: it is the space's own origin plus the action's identifier, which means an
 * author configuring Stripe or GitHub had to know a path nothing in the product told them. One per deployment,
 * because a sender is configured per environment — a single "the URL" is how a staging integration ends up
 * delivering into production.
 *
 * The path is `sdk-server`'s default (`/_action/hook/…`); a deployment that mounts the endpoint somewhere else
 * says so in its own config, and this is a builder that talks to Plitzi's.
 */
const ActionWebhookUrl = ({ identifier, deployments }: ActionWebhookUrlProps) => {
  const [copied, setCopied] = useState('');

  const handleCopy = useCallback(
    (url: string) => () => {
      void navigator.clipboard.writeText(url);
      setCopied(url);
    },
    []
  );

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-gray-300 p-3 dark:border-zinc-600">
      <span className="text-sm font-medium">Where deliveries go</span>
      {deployments.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          This space is not published anywhere yet, so it has no address for a sender to deliver to. Publish it and the
          URL appears here.
        </span>
      )}
      {deployments.map(deployment => {
        const url = `https://${deployment.domain}/_action/hook/${identifier}`;

        return (
          <div key={deployment.domain} className="flex items-center gap-2">
            <div className="flex min-w-0 grow flex-col">
              <span className="text-xs text-gray-500 dark:text-zinc-400">
                {deployment.environment}
                {deployment.isDefault ? ' · default' : ''}
              </span>
              <span className="truncate font-mono text-xs" title={url}>
                {url}
              </span>
            </div>
            <Button size="xs" onClick={handleCopy(url)}>
              {copied === url ? 'Copied' : 'Copy'}
            </Button>
          </div>
        );
      })}
      <span className="text-xs text-gray-500 dark:text-zinc-400">
        POST, with the raw body the signature is computed over. Deliveries that do not verify are refused and show up in
        Recent activity below.
      </span>
    </div>
  );
};

export default ActionWebhookUrl;
