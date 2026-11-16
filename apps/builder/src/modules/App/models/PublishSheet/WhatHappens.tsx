import clsx from 'clsx';

import { changeLines } from '../../components/ChangesSummary/helpers';
import { ENVIRONMENT_META } from '../../helpers/environments';

import type { ContentKind } from './helpers';
import type { PublishedEnvironment } from '../../helpers/environments';
import type { SpacePublishCheck, SpaceServedVersion, SpaceTarget, SpaceVersionChanges } from '@plitzi/sdk-shared';

export type WhatHappensProps = {
  target: SpaceTarget;
  kind: ContentKind;
  /** The version it will show; none for latest changes still to be kept. */
  environment: PublishedEnvironment | undefined;
  revision: number | undefined;
  served: SpaceServedVersion | undefined;
  changes: SpaceVersionChanges | undefined;
  comparing: boolean;
  /** What the platform said publishing it there would do, on a domain holding a copy. */
  check: SpacePublishCheck | undefined;
  checking: boolean;
};

const willShow = ({ kind, environment, revision }: Pick<WhatHappensProps, 'kind' | 'environment' | 'revision'>) => {
  if (kind === 'live') {
    return 'every change as soon as you save it';
  }

  if (!environment) {
    return 'your latest changes';
  }

  return revision === undefined
    ? `your latest changes, kept as a new ${ENVIRONMENT_META[environment].label} version`
    : `${ENVIRONMENT_META[environment].label} r${String(revision)}`;
};

const nowShows = (served: SpaceServedVersion | undefined): string =>
  !served
    ? 'Nothing is published there yet.'
    : served.environment === 'main'
      ? 'Now it shows every change as you save it.'
      : `Now it shows ${ENVIRONMENT_META[served.environment].label} r${String(served.revision)}.`;

/**
 * What publishing does, before anything does, in one place: what the domain will show instead of what, what visitors
 * will see change — the same content said as such, never "nothing changes" beside a new version — and, on a domain
 * holding a copy, whether it needs a deploy and why.
 */
const WhatHappens = ({
  target,
  kind,
  environment,
  revision,
  served,
  changes,
  comparing,
  check,
  checking
}: WhatHappensProps) => {
  const lines = changes ? changeLines(changes) : undefined;
  const needsDeploy = check?.deploy.needed ?? false;

  return (
    <section aria-label="What will happen" className="bg-ui-raised flex flex-col gap-2 rounded-lg px-3 py-2.5 text-sm">
      <p className="text-ui-fg">
        <b>{target.domain}</b> will show {willShow({ kind, environment, revision })}.{' '}
        <span className="text-ui-fg-subtle">{nowShows(served)}</span>
      </p>
      {served && comparing && <span className="text-ui-fg-subtle text-xs">Comparing with what it shows…</span>}
      {served && !comparing && lines && changes?.total === 0 && (
        <span className="text-ui-fg-subtle text-xs">Visitors will see no difference: the content is the same.</span>
      )}
      {served && !comparing && lines && changes?.total !== 0 && (
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-ui-fg">
            <span className="text-ui-fg-subtle">Visitors will see: </span>
            {lines.summary}
          </span>
          {lines.details.length > 0 && (
            <details className="text-ui-fg-subtle">
              <summary className="hover:text-ui-fg w-fit cursor-pointer">Which ones</summary>
              <ul className="mt-1 flex flex-col gap-0.5 pl-3">
                {lines.details.map(line => (
                  <li key={line} className="list-disc">
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {checking && <span className="text-ui-fg-subtle text-xs">Asking what it needs…</span>}
      {check && (
        <ul className="text-ui-fg-subtle flex flex-col gap-1 text-xs">
          <li className="flex gap-2">
            <i
              className={clsx(
                'fa-solid mt-0.5 w-3 text-center',
                needsDeploy ? 'fa-upload text-primary-500' : 'fa-check text-emerald-500'
              )}
              aria-hidden
            />
            <span>
              {needsDeploy
                ? `Its copy on ${target.providerLabel} is deployed again: ${check.deploy.reasons.join('; ')}.`
                : `No deploy needed: its copy on ${target.providerLabel} reads the version its domain shows.`}
            </span>
          </li>
          {check.mode === 'spa' && check.serverFeatures.length > 0 && (
            <li className="flex gap-2">
              <i className="fa-solid fa-server mt-0.5 w-3 text-center" aria-hidden />
              <span>Runs {check.serverFeatures.join(', ')} on Plitzi, from its own address.</span>
            </li>
          )}
          {needsDeploy && !target.atomic && (
            <li className="flex gap-2">
              <i className="fa-solid fa-triangle-exclamation mt-0.5 w-3 text-center text-amber-500" aria-hidden />
              <span>
                {target.providerLabel} replaces the files one by one: for a moment a visitor may get some of each.
              </span>
            </li>
          )}
        </ul>
      )}
      {kind === 'latest' && revision === undefined && target.mode !== 'ssr' && (
        <span className="text-ui-fg-subtle text-xs">
          Its copy on {target.providerLabel} is deployed again when the new version needs it.
        </span>
      )}
    </section>
  );
};

export default WhatHappens;
