import Button from '@plitzi/plitzi-ui/Button';

import Notice from '../../components/Notice';
import { revisionName } from '../../helpers/environments';

import type { SpaceTarget } from '@plitzi/sdk-shared';

export type TargetNoticesProps = {
  target: SpaceTarget;
  working: boolean;
  onDeployAgain: () => void;
  onFollow: () => void;
};

/** What a domain holding a copy asks for before anything else: a deploy that failed, newer versions out, one running. */
const TargetNotices = ({ target, working, onDeployAgain, onFollow }: TargetNoticesProps) => (
  <>
    {(target.update || target.lastDeploy?.status === 'failed') && !target.running && (
      <Notice tone={target.lastDeploy?.status === 'failed' ? 'danger' : 'caution'}>
        <span className="flex items-center justify-between gap-3">
          <span>
            {target.lastDeploy?.status === 'failed'
              ? `Its last deploy failed: ${target.lastDeploy.error ?? 'its log says why'}`
              : target.update?.words}
          </span>
          <Button size="xs" intent="secondary" className="shrink-0" disabled={working} onClick={onDeployAgain}>
            {target.update ? 'Redeploy' : 'Deploy again'}
          </Button>
        </span>
      </Notice>
    )}
    {target.running && (
      <Notice tone="info">
        <span className="flex items-center justify-between gap-3">
          <span>Deploying {revisionName(target.running.environment, target.running.revision)}…</span>
          <Button size="xs" intent="secondary" onClick={onFollow}>
            Follow it
          </Button>
        </span>
      </Notice>
    )}
  </>
);

export default TargetNotices;
