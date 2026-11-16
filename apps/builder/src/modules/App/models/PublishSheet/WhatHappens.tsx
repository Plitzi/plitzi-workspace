import clsx from 'clsx';

import { versionName } from './helpers';
import { revisionName } from '../../helpers/environments';

import type { Environment, SpacePublishCheck, SpaceServedVersion, SpaceTarget } from '@plitzi/sdk-shared';

export type WhatHappensProps = {
  target: SpaceTarget;
  environment: Environment;
  revision: number;
  served: SpaceServedVersion | undefined;
  /** What the platform said publishing it there would do, on a target holding a copy. */
  check: SpacePublishCheck | undefined;
  checking: boolean;
};

/**
 * What a publish will do, in words, before anything does (RFC 0034 §11.3): what the domain will serve instead of what,
 * whether its copy needs a deploy and why, what of the site runs on Plitzi, and whether its provider switches at once.
 */
const WhatHappens = ({ target, environment, revision, served, check, checking }: WhatHappensProps) => {
  const needsDeploy = check?.deploy.needed ?? false;

  return (
    <section aria-label="What will happen" className="flex flex-col gap-1.5 text-sm">
      <p className="text-ui-fg">
        <b>{target.domain}</b> will serve{' '}
        {environment === 'main' ? 'the draft: every saved edit goes live at once' : revisionName(environment, revision)}
        {served && ` — now ${versionName(served)}`}.
      </p>
      {checking && <span className="text-ui-fg-subtle text-xs">Asking what it needs…</span>}
      {check && (
        <ul className="text-ui-fg-subtle flex flex-col gap-1 text-xs">
          <li className="flex gap-2">
            <i
              className={clsx(
                'fa-solid mt-0.5 w-3 text-center',
                needsDeploy ? 'fa-upload text-primary-500' : 'fa-check text-emerald-500'
              )}
            />
            <span>
              {needsDeploy
                ? `It needs a deploy to ${target.providerLabel}: ${check.deploy.reasons.join('; ')}.`
                : `No deploy needed: its copy on ${target.providerLabel} reads the revision its domain serves.`}
            </span>
          </li>
          {check.mode === 'spa' && check.serverFeatures.length > 0 && (
            <li className="flex gap-2">
              <i className="fa-solid fa-server mt-0.5 w-3 text-center" />
              <span>Runs {check.serverFeatures.join(', ')} on Plitzi, from its own address.</span>
            </li>
          )}
          {needsDeploy && !target.atomic && (
            <li className="flex gap-2">
              <i className="fa-solid fa-triangle-exclamation mt-0.5 w-3 text-center text-amber-500" />
              <span>
                {target.providerLabel} replaces the files one by one: for a moment a visitor may get some of each.
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
};

export default WhatHappens;
