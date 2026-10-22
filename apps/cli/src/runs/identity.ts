import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { createExclusive, readJson, writeAtomic } from './files';
import { LEAD } from './messages';
import { RunRefusal } from './refusal';
import { readRecord } from './run/record';
import { readTeam, startedAgents } from './team';

import type { RunPaths } from './paths';

/**
 * Who calls a run's command, proved by a token rather than said: a name is anyone's to type. A name said, or none, was
 * taken at its word — and none, from a shell with no terminal, was the lead (velada-polish: design-2 ran `task look`
 * without `--agent`, and the run's log has the lead looking; one `task review --approve` the same way is the lead's
 * last word, given by a designer). So every agent of a run has a token of its own, `<run>.@<agent>.<secret>`, made at
 * its first command — the lead's when the run opens — kept in its scratch folder, and passed on each command after:
 * a name that has one is refused without it, and a token is refused under another's name.
 */

/** An agent's token: its run, its name, its secret — told apart from a task's (`<run>.<task>.<secret>`) by the `@`. */
export const AGENT_TOKEN = /^([a-z0-9][a-z0-9_-]*)\.@([a-z0-9][a-z0-9_-]*)\.([0-9a-f]{32})$/;

/** A name an agent may go by: what a folder can be named, and a person can type. */
const NAME = /^[a-z][a-z0-9_-]{0,63}$/;

/** Who reads what anyone may read, saying nothing of itself (`runOf`'s `anyone`): no lead, no agent. */
export const UNNAMED = 'unnamed';

/** Names no agent takes: a person is one at a terminal, and the others are what the CLI calls a caller it cannot name. */
const RESERVED = new Set(['person', 'agent', UNNAMED]);

/**
 * What a caller brings to say who it is, read before the run is known. Only an agent's own token says who: a task's
 * says which task — its copy's, for its holder — and a token said that is neither, or empty, is none (velada-fidelity:
 * `--token "$(cat …)"` read from the wrong folder came in empty, ran as "agent" and took a task).
 */
export type Claim =
  /** An agent's own token, with the name it said, if it said one. */
  | { kind: 'agent'; token: string; said?: string }
  /** A name said alone: an agent's first command, or one refused for want of its token. */
  | { kind: 'name'; said: string }
  /** A token said that is no agent's: a task's, or nothing that parses. */
  | { kind: 'malformed'; task: boolean }
  /** A person, at a terminal of their own. */
  | { kind: 'person' }
  /** Nothing said — or `empty`: a token said blank, the `$(cat …)` that should have passed it read nothing. */
  | { kind: 'none'; empty?: true };

/** Who the caller is, proved — and, at its first command, the token made for it. */
export interface Identified {
  agent: string;
  issued?: { token: string; file: string };
}

interface Identity {
  /** The secret's digest: the record proves a token without holding it. */
  digest: string;
  at: string;
}

const isIdentity = (value: unknown): value is Identity =>
  isRecord(value) && typeof value.digest === 'string' && typeof value.at === 'string';

const identityFile = (paths: RunPaths, agent: string): string => path.join(paths.identities, `${agent}.json`);

/** Where an agent's token is kept for it, under a run's scratch folder (`RunPaths.scratch`). */
const tokenIn = (scratch: string, agent: string): string => path.join(scratch, agent, 'token');

/** Where an agent's token is kept for it: its own scratch folder, read back after a harness forgot it. */
export const tokenFile = (paths: RunPaths, agent: string): string => tokenIn(paths.scratch, agent);

const digestOf = (secret: string): string => createHash('sha256').update(secret).digest('hex');

const readIdentity = (paths: RunPaths, agent: string): Promise<Identity | undefined> =>
  readJson(identityFile(paths, agent), isIdentity, `an agent's identity (${agent})`);

/**
 * The token of `agent` on `runId`, made once: undefined when it has one already — a second caller under that name
 * never gets one of its own.
 */
export const issueToken = async (
  paths: RunPaths,
  runId: string,
  agent: string,
  at: Date
): Promise<Identified['issued']> => {
  const secret = randomBytes(16).toString('hex');
  await fs.mkdir(paths.identities, { recursive: true });
  const made = await createExclusive(
    identityFile(paths, agent),
    JSON.stringify({ digest: digestOf(secret), at: at.toISOString() } satisfies Identity)
  );
  if (!made) {
    return undefined;
  }

  const token = `${runId}.@${agent}.${secret}`;
  const file = tokenFile(paths, agent);
  await writeAtomic(file, `${token}\n`);

  return { token, file };
};

const notYours = (paths: RunPaths, agent: string): RunRefusal =>
  new RunRefusal(
    'identity',
    `${agent} has a token on this run: a command as ${agent} passes it (--token) — a name alone is anyone's to type. Its first command printed it, and it is kept in ${tokenFile(paths, agent)}`,
    { agent }
  );

/** The names a run's agents go by: its team's, `lead` and its co-leads — none when the project has no team. */
const namesOf = async (root: string, paths: RunPaths): Promise<string[] | undefined> => {
  const team = await readTeam(root).catch(() => undefined);
  if (!team) {
    return undefined;
  }

  const record = await readRecord(paths).catch(() => undefined);

  return [LEAD, ...(record?.leads ?? []), ...startedAgents(team).map(each => each.agent)];
};

const proveToken = async (paths: RunPaths, runId: string, token: string): Promise<string> => {
  const [, run, agent, secret] = AGENT_TOKEN.exec(token) ?? [];
  if (!run || !agent || !secret) {
    throw new RunRefusal(
      'identity',
      'That is no agent’s token: <run>.@<agent>.<secret>, as your first command printed it'
    );
  }

  if (run !== runId) {
    throw new RunRefusal('identity', `That token is a caller's of run "${run}", not of "${runId}"`, { agent });
  }

  const identity = await readIdentity(paths, agent);
  const given = Buffer.from(digestOf(secret), 'hex');
  const kept = identity ? Buffer.from(identity.digest, 'hex') : undefined;
  if (!kept || kept.length !== given.length || !timingSafeEqual(kept, given)) {
    throw new RunRefusal(
      'identity',
      `That token is no one's on run "${runId}": ${agent}'s, as its first command printed it, is kept in ${tokenFile(paths, agent)}`,
      { agent }
    );
  }

  return agent;
};

/**
 * Who calls, on `runId`, proved: an agent by its token, a person by their terminal — and a name said alone only the first
 * time, when it is made a token. Refused otherwise, saying what to pass: never a name the CLI makes up.
 */
export const identify = async (
  root: string,
  paths: RunPaths,
  runId: string,
  claim: Claim,
  at: Date
): Promise<Identified> => {
  if (claim.kind === 'person') {
    return { agent: 'person' };
  }

  if (claim.kind === 'none' && claim.empty) {
    // velada-shell's design-1 passed `--token ""`: its copy had just been removed under it, and "who is calling?" said
    // nothing of why its own token was not there.
    throw new RunRefusal(
      'identity',
      `--token was said empty: the \`$(cat …)\` that passes it read nothing. Read it by its whole path — ${tokenFile(paths, '<you>')} — from the project's folder; if this shell's folder was a task's copy, it is gone once the task is approved or cut: cd to the project first`
    );
  }

  if (claim.kind === 'none') {
    throw new RunRefusal(
      'identity',
      `Who is calling? Pass your token (--token), inside a task's copy too: your first command on run "${runId}" printed it, and it is kept in ${tokenFile(paths, '<you>')}. A newcomer names itself once (--agent <name>) and is given one`
    );
  }

  if (claim.kind === 'malformed') {
    throw new RunRefusal(
      'identity',
      claim.task
        ? `A task's token says which task, not who calls: pass your own (--token), as your first command on run "${runId}" printed it — kept in ${tokenFile(paths, '<you>')} — and work in the task's copy, which says the task`
        : `That is no agent's token: <run>.@<agent>.<secret>, as your first command printed it — kept in ${tokenFile(paths, '<you>')}`
    );
  }

  if (claim.kind === 'agent') {
    const agent = await proveToken(paths, runId, claim.token);
    if (claim.said !== undefined && claim.said !== agent) {
      throw new RunRefusal(
        'identity',
        `Your token is ${agent}'s: --agent ${claim.said} says otherwise — a caller is who its token says`,
        {
          agent
        }
      );
    }

    return { agent };
  }

  const name = claim.said;
  if (!NAME.test(name) || RESERVED.has(name)) {
    throw new RunRefusal(
      'identity',
      name === 'person'
        ? 'A person is one at a terminal of their own: an agent names itself, never "person"'
        : `"${name}" is no name an agent goes by: letters, digits, - and _, starting with a letter`
    );
  }

  if (await readIdentity(paths, name)) {
    throw notYours(paths, name);
  }

  const names = await namesOf(root, paths);
  if (names && !names.includes(name)) {
    throw new RunRefusal(
      'identity',
      `${name} is no agent of this project's team: its agents are ${names.join(', ')} — name yourself as the one you were started as`,
      { agent: name }
    );
  }

  const issued = await issueToken(paths, runId, name, at);
  if (!issued) {
    throw notYours(paths, name);
  }

  return { agent: name, issued };
};

/** What an agent is told when its token is made: once, where it reads it, with what to do with it. */
export const issuedText = (runId: string, agent: string, issued: NonNullable<Identified['issued']>): string =>
  `You are ${agent} on run "${runId}". Your token: ${issued.token} — pass it on every command from now on (--token ${issued.token}); --agent ${agent} alone is refused from here on. It is kept in ${issued.file}`;

/** Who has a token on the run already: named by it from its next start, never by its name again. */
export const identifiedAgents = async (paths: RunPaths): Promise<string[]> =>
  (await fs.readdir(paths.identities).catch((): string[] => []))
    .filter(file => file.endsWith('.json'))
    .map(file => file.slice(0, -'.json'.length))
    .sort();

/**
 * How a command names `agent`: by its name the first time; after, by its token, read from where it is kept — by its
 * whole path, so it reads the same from a task's copy as from the project (a path from the project's root read nothing
 * in a copy, and an empty token was what let a caller in unnamed).
 */
export const callerFlag = (scratch: string, agent: string, identified: readonly string[]): string =>
  identified.includes(agent) ? `--token "$(cat ${tokenIn(scratch, agent)})"` : `--agent ${agent}`;

/**
 * The roles `agent` asks work of, held to its team's: a developer that says `--role designer` takes no UI review, and
 * a designer no developer's task — its name proved, its roles are the team's to give, not its own to say.
 */
export const assertRoles = async (root: string, agent: string, roles: readonly string[]): Promise<void> => {
  const team = await readTeam(root).catch(() => undefined);
  const member = team ? startedAgents(team).find(each => each.agent === agent) : undefined;
  const foreign = member ? roles.filter(role => !member.roles.includes(role)) : [];
  if (member && foreign.length > 0) {
    throw new RunRefusal(
      'identity',
      `${agent} is a ${member.roles.join(', ')} of the team, not a ${foreign.join(', ')}: ask for work as what you were started as (--role ${member.roles.join(',')})`,
      { agent, roles: member.roles }
    );
  }
};
