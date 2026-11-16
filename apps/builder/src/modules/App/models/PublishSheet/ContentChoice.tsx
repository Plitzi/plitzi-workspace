import ContentOption from './ContentOption';
import LatestChanges from './LatestChanges';
import RevisionList from './RevisionList';
import EnvironmentSegments from '../../components/EnvironmentSegments';
import { PUBLISHED_ENVIRONMENTS } from '../../helpers/environments';
import { latestDetail } from '../../hooks/useLatestSnapshots';

import type { ContentKind } from './helpers';
import type { PublishedEnvironment } from '../../helpers/environments';
import type { Environment, SpaceSnapshot } from '@plitzi/sdk-shared';

export type ContentChoiceProps = {
  domain: string;
  kind: ContentKind;
  /** Every save is offered only where Plitzi serves the domain: a copy is a version, deployed. */
  offersLive: boolean;
  /** The plan that includes versions, when the space's includes none. */
  versionsLockedBy?: string;
  latest: {
    environment: PublishedEnvironment | undefined;
    environments: readonly PublishedEnvironment[];
    keptAs: number | undefined;
    description: string;
    onEnvironment: (environment: PublishedEnvironment) => void;
    onDescription: (description: string) => void;
  };
  saved: {
    environment: PublishedEnvironment;
    byEnvironment: Record<PublishedEnvironment, SpaceSnapshot | undefined>;
    lockedBy: (environment: PublishedEnvironment) => string | undefined;
    snapshots: readonly SpaceSnapshot[];
    loading: boolean;
    revision: number | undefined;
    onEnvironment: (environment: Environment) => void;
    onRevision: (revision: number) => void;
  };
  onKind: (kind: ContentKind) => void;
};

/**
 * What a domain should show, in three answers anybody reads: the latest changes (kept as a version on the way, so there
 * is always one to go back to), a version kept before, or every save as it happens.
 */
const ContentChoice = ({ domain, kind, offersLive, versionsLockedBy, latest, saved, onKind }: ContentChoiceProps) => (
  <section className="flex flex-col gap-2" aria-label="What it shows">
    <h5 className="text-ui-fg text-sm font-semibold">What should {domain} show?</h5>
    <div role="radiogroup" aria-label="What it shows" className="flex flex-col gap-1.5">
      <ContentOption
        kind="latest"
        chosen={kind === 'latest'}
        title="Your latest changes"
        detail="What you see in the editor now. It is kept as a version first, so you can always go back to it."
        lockedBy={versionsLockedBy}
        onChoose={onKind}
      >
        {latest.environment && (
          <LatestChanges
            environment={latest.environment}
            environments={latest.environments}
            keptAs={latest.keptAs}
            description={latest.description}
            onEnvironment={latest.onEnvironment}
            onDescription={latest.onDescription}
          />
        )}
      </ContentOption>
      <ContentOption
        kind="saved"
        chosen={kind === 'saved'}
        title="A version you kept"
        detail="One you kept before with Snapshot, or published already — to publish it here, or go back to it."
        lockedBy={versionsLockedBy}
        onChoose={onKind}
      >
        <EnvironmentSegments
          label="Kept in"
          value={saved.environment}
          onChange={saved.onEnvironment}
          segments={PUBLISHED_ENVIRONMENTS.map(env => ({
            value: env,
            detail: latestDetail(saved.byEnvironment[env]),
            lockedBy: saved.lockedBy(env)
          }))}
        />
        <RevisionList
          environment={saved.environment}
          snapshots={saved.snapshots}
          loading={saved.loading}
          revision={saved.revision}
          domain={domain}
          onPick={saved.onRevision}
        />
      </ContentOption>
      {offersLive && (
        <ContentOption
          kind="live"
          chosen={kind === 'live'}
          title="Every change, as you save it"
          detail="Like your Plitzi address: visitors see each edit the moment it is saved — unfinished ones too."
          onChoose={onKind}
        />
      )}
    </div>
  </section>
);

export default ContentChoice;
