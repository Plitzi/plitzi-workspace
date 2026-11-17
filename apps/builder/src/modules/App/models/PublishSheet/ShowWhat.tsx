import { ENVIRONMENT_PURPOSE } from './helpers';
import SaveFirst from './SaveFirst';
import VersionChoice from './VersionChoice';
import EnvironmentSegments from '../../components/EnvironmentSegments';
import { PUBLISHED_ENVIRONMENTS } from '../../helpers/environments';
import { latestDetail } from '../../hooks/useLatestSnapshots';

import type { PublishedEnvironment } from '../../helpers/environments';
import type { Environment, SpaceSnapshot, SpaceVersionChanges } from '@plitzi/sdk-shared';

export type ShowWhatProps = {
  domain: string;
  environment: Environment;
  /** Every save is offered only where Plitzi serves the domain: a copy is a version, deployed. */
  offersDraft: boolean;
  byEnvironment: Record<PublishedEnvironment, SpaceSnapshot | undefined>;
  lockedBy: (environment: PublishedEnvironment) => string | undefined;
  onEnvironment: (environment: Environment) => void;
  version: {
    follows: boolean;
    revision: number | undefined;
    snapshots: readonly SpaceSnapshot[];
    loading: boolean;
    onFollow: (follows: boolean) => void;
    onPick: (revision: number) => void;
  };
  keep: {
    shown: boolean;
    changes: SpaceVersionChanges | undefined;
    checked: boolean;
    description: string;
    onChecked: (checked: boolean) => void;
    onDescription: (description: string) => void;
  };
};

/**
 * What the chosen domain will show, in the order anybody decides it: the environment (each said for what it is for),
 * then which of its versions — the latest, or one — and, for the latest, whether the editor's changes are kept as a
 * new one first.
 */
const ShowWhat = ({
  domain,
  environment,
  offersDraft,
  byEnvironment,
  lockedBy,
  onEnvironment,
  version,
  keep
}: ShowWhatProps) => (
  <section className="flex flex-col gap-3" aria-label={`Publish to ${domain}`}>
    <h5 className="text-ui-fg text-sm font-semibold">
      Publish to <span className="text-primary-600 dark:text-primary-300">{domain}</span>
    </h5>
    <div className="flex flex-col gap-1">
      <EnvironmentSegments
        label="Environment"
        value={environment}
        onChange={onEnvironment}
        segments={[
          ...(offersDraft ? [{ value: 'main' as const, detail: 'Every save' }] : []),
          ...PUBLISHED_ENVIRONMENTS.map(env => ({
            value: env,
            detail: latestDetail(byEnvironment[env]),
            lockedBy: lockedBy(env)
          }))
        ]}
      />
      <span className="text-ui-fg-subtle text-xs">{ENVIRONMENT_PURPOSE[environment]}</span>
    </div>
    {environment !== 'main' && (
      <VersionChoice
        domain={domain}
        environment={environment}
        latest={byEnvironment[environment]}
        follows={version.follows}
        revision={version.revision}
        snapshots={version.snapshots}
        loading={version.loading}
        onFollow={version.onFollow}
        onPick={version.onPick}
      />
    )}
    {environment !== 'main' && keep.shown && (
      <SaveFirst
        environment={environment}
        latest={byEnvironment[environment]}
        changes={keep.changes}
        checked={keep.checked}
        description={keep.description}
        onChecked={keep.onChecked}
        onDescription={keep.onDescription}
      />
    )}
  </section>
);

export default ShowWhat;
