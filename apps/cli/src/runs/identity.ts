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
 * taken at its word — and none, from a shell with no terminal, was the lead (design-2 ran `task look`
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
 * says which task — its copy's, for its holder — and a token said that is neither, or empty, is none (* `--token "$(cat …)"` read from the wrong folder came in empty, ran as "agent" and took a task).
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
  issued?: { token: string; file: string; cli: string };
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

/** An agent's own CLI, beside its token (`writeCli`). */
const cliIn = (scratch: string, agent: string): string => path.join(scratch, agent, 'plitzi');

export const cliFile = (paths: RunPaths, agent: string): string => cliIn(paths.scratch, agent);

const shellQuoted = (word: string): string => `'${word.replace(/'/g, `'\\''`)}'`;

/**
 * An agent's own CLI: the project's, run with its token — so every command it types is `<its plitzi> task check`, never
 * `--token "$(cat …)"`. That flag and the CLI's path were 300 characters of every command, each kept in the
 * agent's context and read again on every turn after; and a run's `$(cat …)`, read from the wrong folder, came
 * in empty. Written with the token, and again by `run agent` — the same file each time.
 */
export const writeCli = async (paths: RunPaths, agent: string): Promise<string> => {
  const file = cliFile(paths, agent);
  const bin = path.join(paths.root, 'node_modules', '.bin', 'plitzi');
  await writeAtomic(
    file,
    [
      '#!/bin/sh',
      `# ${agent}'s plitzi: the project's, with ${agent}'s token (PLITZI_TOKEN), read on each command.`,
      `PLITZI_TOKEN="$(cat ${shellQuoted(tokenFile(paths, agent))})"`,
      'export PLITZI_TOKEN',
      `exec ${shellQuoted(bin)} "$@"`,
      ''
    ].join('\n')
  );
  await fs.chmod(file, 0o755);

  return file;
};

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

  return { token, file, cli: await writeCli(paths, agent) };
};

const notYours = (paths: RunPaths, agent: string): RunRefusal =>
  new RunRefusal(
    'identity',
    `${agent} has a token on this run: a command as ${agent} runs through its own CLI, ${cliFile(paths, agent)}, which passes it (or --token) — a name alone is anyone's to type`,
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
    // A run's design-1 passed `--token ""`: its copy had just been removed under it, and "who is calling?" said
    // nothing of why its own token was not there.
    throw new RunRefusal(
      'identity',
      `--token was said empty: the \`$(cat …)\` that passes it read nothing. Read it by its whole path — ${tokenFile(paths, '<you>')} — from the project's folder; if this shell's folder was a task's copy, it is gone once the task is approved or cut: cd to the project first`
    );
  }

  if (claim.kind === 'none') {
    throw new RunRefusal(
      'identity',
      `Who is calling? Run your commands through your own CLI, ${cliFile(paths, '<you>')}, which passes your token (or --token, kept beside it), inside a task's copy too. A newcomer names itself once (--agent <name>) and is given both`
    );
  }

  if (claim.kind === 'malformed') {
    throw new RunRefusal(
      'identity',
      claim.task
        ? `A task's token says which task, not who calls: run your commands through your own CLI, ${cliFile(paths, '<you>')}, which passes your own token, and work in the task's copy, which says the task`
        : `That is no agent's token: <run>.@<agent>.<secret> — your own CLI, ${cliFile(paths, '<you>')}, passes yours`
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
  `You are ${agent} on run "${runId}". Run every command from now on through your own CLI, ${issued.cli} — it passes your token (${issued.token}, kept in ${issued.file}); --agent ${agent} alone is refused from here on`;

/** Who has a token on the run already: named by it from its next start, never by its name again. */
export const identifiedAgents = async (paths: RunPaths): Promise<string[]> =>
  (await fs.readdir(paths.identities).catch((): string[] => []))
    .filter(file => file.endsWith('.json'))
    .map(file => file.slice(0, -'.json'.length))
    .sort();

/**
 * A command as `agent`, said to whoever starts it: by its name the first time; after, through its own CLI, by its whole
 * path — it reads the same from a task's copy as from the project (a token read by a path from the
 * project's root read nothing in a copy, and an empty token was what let a caller in unnamed).
 */
export const commandAs = (scratch: string, agent: string, identified: readonly string[], args: string): string =>
  identified.includes(agent) ? `${cliIn(scratch, agent)} ${args}` : `plitzi ${args} --agent ${agent}`;

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
      `${agent} is a ${member.roles.join(', ')} of the team, not a ${foreign.join(', ')}: ask for work as what you were started as (plitzi task next --role ${member.roles.join(',')})`,
      { agent, roles: member.roles }
    );
  }
};
