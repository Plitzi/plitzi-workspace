import Button from '@plitzi/plitzi-ui/Button';
import { memo, useCallback } from 'react';

import useSpaceEntitlements from '@pmodules/Space/hooks/useSpaceEntitlements';

/**
 * The space's plan, in the header beside what it spends — and, while the plan leaves something out, the way to one
 * that does not. Nothing on a server that answers no plan (self-hosted).
 */
const PlanBadge = () => {
  const { entitlements } = useSpaceEntitlements();
  const next = entitlements
    ? Object.values(entitlements.capabilities).find(capability => !capability.included && capability.upgradeUrl)
    : undefined;
  const upgradeUrl = next?.upgradeUrl;

  const handleUpgrade = useCallback(() => {
    if (upgradeUrl) {
      window.open(upgradeUrl, '_blank', 'noopener,noreferrer');
    }
  }, [upgradeUrl]);

  if (!entitlements) {
    return null;
  }

  return (
    <div id="header-plan" className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <span
        className="rounded-full border border-gray-300 px-2 py-0.5 whitespace-nowrap text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
        title="This space's plan"
      >
        {entitlements.tierLabel} plan
      </span>
      {upgradeUrl && (
        <Button
          size="xs"
          intent="secondary"
          onClick={handleUpgrade}
          title={`${next.label} needs the ${next.requires ?? ''} plan`}
        >
          Upgrade
        </Button>
      )}
    </div>
  );
};

export default memo(PlanBadge);
