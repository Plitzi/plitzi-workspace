import clsx from 'clsx';

import { changeLines } from '../../components/ChangesSummary/helpers';
import { ENVIRONMENT_META } from '../../helpers/environments';

import type {
  Environment,
  SpacePublishCheck,
  SpaceServedVersion,
  SpaceTarget,
  SpaceVersionChanges
} from '@plitzi/sdk-shared';

export type WhatHappensProps = {
  target: SpaceTarget;
  environment: Environment;
  /** It follows the environment's latest, or stays on `revision`. */
  follows: boolean;
  /** The version it comes to: none yet for changes still to be kept. */
  revision: number | undefined;
  /** The editor's changes are kept as a new version first. */
  keepsFirst: boolean;
  served: SpaceServedVersion | undefined;
  changes: SpaceVersionChanges | undefined;
  comparing: boolean;
  /** What the platform said publishing it there would do, on a domain holding a copy. */
  check: SpacePublishCheck | undefined;
  checking: boolean;
};

const willShow = ({
  environment,
  follows,
  revision,
  keepsFirst
}: Pick<WhatHappensProps, 'environment' | 'follows' | 'revision' | 'keepsFirst'>): string => {
  if (environment === 'main') {
    return 'every change as soon as you save it';
  }

  const label = ENVIRONMENT_META[environment].label;
  if (!follows) {
    return revision === undefined ? `a ${label} version` : `${label} v${String(revision)}, and stay on it`;
  }

  return keepsFirst
    ? `your current changes, kept as the next ${label} version — and each one kept after it`
    : `the latest ${label} version${revision === undefined ? '' : ` (v${String(revision)} now)`}, and each one kept after it`;
};

const nowShows = (target: SpaceTarget, served: SpaceServedVersion | undefined): string => {
  if (!served) {
    return 'Nothing is published there yet.';
  }

  if (served.environment === 'main') {
    return 'Now it shows every change as you save it.';
  }

  const label = ENVIRONMENT_META[served.environment].label;

  return target.revision === null
    ? `Now it shows the latest ${label} version (v${String(served.revision)}).`
    : `Now it stays on ${label} v${String(served.revision)}.`;
};

/**
 * What publishing does, before anything does, in one place: what the domain will show instead of what, what visitors
 * will see change — the same content said as such, never "nothing changes" beside a new version — and, on a domain
 * holding a copy, whether it needs a deploy and why.
 */
const WhatHappens = ({
  target,
  environment,
  follows,
  revision,
  keepsFirst,
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
        <b>{target.domain}</b> will show {willShow({ environment, follows, revision, keepsFirst })}.{' '}
        <span className="text-ui-fg-subtle">{nowShows(target, served)}</span>
      </p>
      {served?.environment === 'main' && environment !== 'main' && (
        <span className="text-ui-fg-subtle text-xs">
          {follows
            ? `From then on, your edits reach it when you keep them as a new ${ENVIRONMENT_META[environment].label} version — Publish or Save version does.`
            : 'From then on, your edits wait for your next publish: visitors no longer see them as you save.'}
        </span>
      )}
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
      {keepsFirst && target.mode !== 'ssr' && (
        <span className="text-ui-fg-subtle text-xs">
          Its copy on {target.providerLabel} is deployed again when the new version needs it.
        </span>
      )}
    </section>
  );
};

export default WhatHappens;
