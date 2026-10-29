import Alert from '@plitzi/plitzi-ui/Alert';

import useSpaceEntitlements from '../../hooks/useSpaceEntitlements';

export type PlanNoticeProps = {
  /** The capability the panel is about, as the server's entitlements name it: `functions`, `visitors`… */
  capability: string;
  /** What the panel's work does on a plan without it, said after the plan: "Saved functions are kept; they do not run." */
  meanwhile?: string;
};

/**
 * Where a panel's capability is not in the space's plan, says so at its top — the plan that includes it and the way
 * there — before anyone fills in a form the server will refuse. Nothing when the plan includes it, or
 * when the server answered no plan at all (a self-hosted deployment).
 */
const PlanNotice = ({ capability, meanwhile }: PlanNoticeProps) => {
  const { locked } = useSpaceEntitlements();
  const missing = locked(capability);
  if (!missing) {
    return null;
  }

  return (
    <Alert intent="warning" size="sm" solid={false}>
      {missing.label} {missing.requires ? `is included in the ${missing.requires} plan and above.` : 'is not included.'}
      {meanwhile ? ` ${meanwhile}` : ''}{' '}
      {missing.upgradeUrl && (
        <a href={missing.upgradeUrl} target="_blank" rel="noreferrer noopener" className="underline">
          See the plans
        </a>
      )}
    </Alert>
  );
};

export default PlanNotice;
