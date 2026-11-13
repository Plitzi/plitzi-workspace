import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useState } from 'react';

export type ActionWebhookUrlProps = {
  identifier: string;
  deployments: { environment: string; domain: string; isDefault: boolean }[];
};

/** The path mirrors sdk-server's webhook endpoint mount. */
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
    <div className="border-ui-line flex flex-col gap-3 rounded-lg border p-4">
      <span className="text-sm font-medium">Where deliveries go</span>
      {deployments.length === 0 && (
        <span className="text-ui-fg-subtle text-xs">
          This space is not published anywhere yet, so it has no address for a sender to deliver to. Publish it and the
          URL appears here.
        </span>
      )}
      {deployments.map(deployment => {
        const url = `https://${deployment.domain}/_action/hook/${identifier}`;

        return (
          <div key={deployment.domain} className="flex items-center gap-2">
            <div className="flex min-w-0 grow flex-col">
              <span className="text-ui-fg-subtle text-xs">
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
      <span className="text-ui-fg-subtle text-xs">
        POST, with the raw body the signature is computed over. Deliveries that do not verify are refused and show up in
        Recent activity below.
      </span>
    </div>
  );
};

export default ActionWebhookUrl;
