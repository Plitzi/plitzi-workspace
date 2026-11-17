import LatestChanges from './LatestChanges';
import { ageAgo } from '../../helpers/age';
import { revisionName } from '../../helpers/environments';

import type { ContentKind } from './helpers';
import type { PublishedEnvironment } from '../../helpers/environments';
import type { SpaceSnapshot } from '@plitzi/sdk-shared';

export type PublishWhatProps = {
  domain: string;
  kind: ContentKind;
  /** Where the latest changes are kept: none when the plan includes no versions. */
  latestEnvironment: PublishedEnvironment | undefined;
  keptAs: number | undefined;
  description: string;
  onDescription: (description: string) => void;
  /** The version kept before, when that is what is published — chosen in the history, or just kept with Snapshot. */
  savedEnvironment: PublishedEnvironment;
  savedRevision: number | undefined;
  savedSnapshot: SpaceSnapshot | undefined;
  /** The plan that includes versions, when the space's includes none: every save is all a domain can show. */
  versionsLockedBy?: string;
  /** Back to what Publish means — the latest changes — from a version or every save chosen elsewhere. */
  onLatest: () => void;
};

const titleOf = ({
  domain,
  kind,
  savedEnvironment,
  savedRevision
}: Pick<PublishWhatProps, 'domain' | 'kind' | 'savedEnvironment' | 'savedRevision'>): string =>
  kind === 'latest'
    ? `Publish your latest changes on ${domain}`
    : kind === 'live'
      ? `Show every change on ${domain} as you save it`
      : `Publish ${savedRevision === undefined ? 'a version you kept' : revisionName(savedEnvironment, savedRevision)} on ${domain}`;

const detailOf = (kind: ContentKind, snapshot: SpaceSnapshot | undefined): string =>
  kind === 'latest'
    ? 'What you see in the editor now. It is kept as a version first, so you can always go back to it.'
    : kind === 'live'
      ? 'Like your Plitzi address: visitors see each edit the moment it is saved — unfinished ones too.'
      : snapshot
        ? `A version you kept ${ageAgo(snapshot.publishedAt)}${snapshot.description ? `: “${snapshot.description}”` : ''}.`
        : 'A version you kept before.';

/**
 * What Publish puts on the domain, said as one thing: the latest changes — what pressing Publish means — or, when chosen
 * elsewhere (a version in the history, every save in the domain's settings), that one, with the way back.
 */
const PublishWhat = ({
  domain,
  kind,
  latestEnvironment,
  keptAs,
  description,
  onDescription,
  savedEnvironment,
  savedRevision,
  savedSnapshot,
  versionsLockedBy,
  onLatest
}: PublishWhatProps) => (
  <section className="flex flex-col gap-2" aria-label="What it publishes">
    <div className="flex flex-col gap-0.5">
      <h5 className="text-ui-fg text-sm font-semibold">{titleOf({ domain, kind, savedEnvironment, savedRevision })}</h5>
      <span className="text-ui-fg-subtle text-xs">{detailOf(kind, savedSnapshot)}</span>
    </div>
    {kind === 'latest' && latestEnvironment && (
      <LatestChanges
        environment={latestEnvironment}
        keptAs={keptAs}
        description={description}
        onDescription={onDescription}
      />
    )}
    {kind !== 'latest' && !versionsLockedBy && (
      <button type="button" className="text-ui-fg-subtle hover:text-ui-fg w-fit text-xs underline" onClick={onLatest}>
        Publish your latest changes instead
      </button>
    )}
    {versionsLockedBy && (
      <span className="text-ui-fg-subtle text-xs">
        Choosing when your changes go out — versions you publish, and go back to — is included in the {versionsLockedBy}{' '}
        plan.
      </span>
    )}
  </section>
);

export default PublishWhat;
