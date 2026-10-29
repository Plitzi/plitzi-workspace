import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { sayer } from './types';
import { authorizedRequest, currentConnection } from '../account/session';
import { readFunctionsFiles } from '../commands/functions/functions';
import { FUNCTIONS_DIR, RUNTIME_ENTRY } from '../scaffold/paths';

import type { Check, Finding } from './types';
import type { TCapability, TSpaceEntitlements } from '@plitzi/sdk-shared/network';

/**
 * What the project uses that the plan of the space it goes up to does not include — asked of the
 * platform, as the person signed in, only for a project made from a space there: a project of no space, or of a
 * self-hosted server that answers no plan, is never told about one. The rest of the doctor reads the project alone; this
 * area is the one question it has to ask.
 */

const say = sayer('plan');

const exists = (file: string): Promise<boolean> =>
  fs.access(file).then(
    () => true,
    () => false
  );

const isEntitlements = (value: unknown): value is TSpaceEntitlements =>
  isRecord(value) && typeof value.tierLabel === 'string' && isRecord(value.capabilities);

/** What the project has that a capability is about: the part, where it is, and what it does without the plan. */
const USES = [
  { capability: 'functions', what: 'functions', where: FUNCTIONS_DIR, without: 'they are saved and do not run' },
  { capability: 'runtime', what: 'a runtime', where: RUNTIME_ENTRY, without: 'it is kept and does not start' },
  {
    capability: 'cliCloud',
    what: 'a space on the platform',
    where: '.plitzi/space.json',
    without: '`plitzi space push` and `pull` are refused'
  }
] as const;

/** What the plan says of a capability it names and does not include; nothing of one it includes or does not name. */
const missing = (entitlements: TSpaceEntitlements, capability: string): TCapability | undefined => {
  if (!Object.hasOwn(entitlements.capabilities, capability)) {
    return undefined;
  }

  const said = entitlements.capabilities[capability];

  return said.included ? undefined : said;
};

export const checkPlan: Check = async ({ root, origin }) => {
  if (!origin) {
    return [];
  }

  const connection = await currentConnection(origin.api);
  if (!connection.ok || !connection.value) {
    return [
      say.info('plan-not-checked', `Not signed in to ${origin.api}: what the space's plan includes is not checked.`, {
        fix: `plitzi login --api ${origin.api}`
      })
    ];
  }

  const answer = await authorizedRequest<{ entitlements?: unknown }>(
    connection.value,
    `/spaces/${String(origin.space.id)}/entitlements`
  );
  if (!answer.ok || answer.value.reply.status !== 200) {
    return [
      say.info(
        'plan-not-checked',
        `The space's plan could not be read: ${answer.ok ? `the platform answered ${String(answer.value.reply.status)}` : answer.error}`
      )
    ];
  }

  const { entitlements } = answer.value.reply.data;
  if (!isEntitlements(entitlements)) {
    // A server that answers no plan includes everything.
    return [];
  }

  const used = {
    functions: Object.keys(await readFunctionsFiles(root).catch(() => ({}))).length > 0,
    runtime: await exists(path.join(root, RUNTIME_ENTRY)),
    cliCloud: true
  };
  const findings: Finding[] = [];
  for (const { capability, what, where, without } of USES) {
    const lacking = used[capability] ? missing(entitlements, capability) : undefined;
    if (lacking) {
      findings.push(
        say.warning(
          `plan-excludes-${capability}`,
          `The project has ${what}, and ${origin.space.name}'s plan (${entitlements.tierLabel}) does not include ${lacking.label.charAt(0).toLowerCase()}${lacking.label.slice(1)}: ${without}. The ${lacking.requires ?? 'next'} plan includes it.`,
          { file: where, ...(lacking.upgradeUrl ? { fix: `Upgrade: ${lacking.upgradeUrl}` } : {}) }
        )
      );
    }
  }

  return findings;
};
