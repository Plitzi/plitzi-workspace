import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { RunRefusal } from './refusal';

/**
 * Which model works which role of a run (RFC 0028): the project's own choice, in `.plitzi/models.json` — committed, so
 * the team shares it — that a person edits, or asks an agent to change with `plitzi run models set`. The CLI starts no
 * agent: the lead's harness does, and reads here what to start each with — `run plan` groups the tasks by it. A model is
 * the harness's own name for it (`claude-sonnet-5-5`, `openrouter/…`): nothing is checked but that one is named.
 *
 * ```json
 * { "version": 1, "roles": { "lead": { "model": "claude-opus-5-5", "effort": "high" },
 *   "default": { "model": "claude-sonnet-5-5" }, "designer": { "model": "claude-opus-5-5" } } }
 * ```
 */

export const MODELS_FILE = path.join('.plitzi', 'models.json');

export interface RoleModel {
  model: string;
  /** How hard it thinks, in the harness's words (`high`) — left to it when not said. */
  effort?: string;
}

export interface ModelsConfig {
  version: 1;
  /** By role — a task's role, `lead` for the lead, `default` for any role not named. */
  roles: Record<string, RoleModel>;
}

/** A role's name as the plan writes one, or the two the config adds. */
const ROLE = /^[a-z][a-z0-9_-]{0,63}$/;

const isRoleModel = (value: unknown): value is RoleModel =>
  isRecord(value) &&
  typeof value.model === 'string' &&
  value.model.trim() !== '' &&
  (value.effort === undefined || typeof value.effort === 'string');

/** The project's models, or none when it has not chosen — refused, saying what is wrong, when the file is not one. */
export const readModels = async (root: string): Promise<ModelsConfig | undefined> => {
  const text = await fs.readFile(path.join(root, MODELS_FILE), 'utf-8').catch(() => undefined);
  if (text === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RunRefusal('invalid', `${MODELS_FILE} is not JSON: fix it, or remove it to choose none`);
  }

  const roles = isRecord(parsed) ? parsed.roles : undefined;
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(roles)) {
    throw new RunRefusal('invalid', `${MODELS_FILE} is not { "version": 1, "roles": { "<role>": { "model": "…" } } }`);
  }

  const wrong = Object.entries(roles).filter(([role, value]) => !ROLE.test(role) || !isRoleModel(value));
  if (wrong.length > 0) {
    throw new RunRefusal(
      'invalid',
      `${MODELS_FILE}: ${wrong.map(([role]) => `"${role}"`).join(', ')} is not a role with { "model": "…", "effort"?: "…" }`
    );
  }

  return {
    version: 1,
    roles: Object.fromEntries(
      Object.entries(roles).filter((entry): entry is [string, RoleModel] => isRoleModel(entry[1]))
    )
  };
};

/** The model a role is worked with: its own, else the default — none when the project chose neither. */
export const modelFor = (config: ModelsConfig | undefined, role: string): RoleModel | undefined =>
  config?.roles[role] ?? config?.roles.default;

export const modelText = (model: RoleModel): string => `${model.model}${model.effort ? ` (${model.effort})` : ''}`;

/**
 * `plitzi run models set|unset`: one role's model changed — or, with no model, taken out — and what it was before said
 * with what it is now. Nothing else of the file is touched.
 */
export const setModel = async (
  root: string,
  role: string,
  model: RoleModel | undefined
): Promise<{ role: string; before?: RoleModel; after?: RoleModel; file: string }> => {
  if (!ROLE.test(role)) {
    throw new RunRefusal('invalid', `"${role}" is no role: a task's role (developer, designer…), lead or default`);
  }

  if (model !== undefined && model.model.trim() === '') {
    throw new RunRefusal('invalid', 'A model is named: the harness’s own name for it — claude-sonnet-5-5');
  }

  const config = (await readModels(root)) ?? { version: 1, roles: {} };
  const before = Object.hasOwn(config.roles, role) ? config.roles[role] : undefined;
  if (model === undefined && before === undefined) {
    throw new RunRefusal('invalid', `"${role}" has no model of its own to take out (${MODELS_FILE})`);
  }

  const others = Object.entries(config.roles).filter(([name]) => name !== role);
  const roles = Object.fromEntries(model === undefined ? others : [...others, [role, model]]);

  await fs.mkdir(path.join(root, path.dirname(MODELS_FILE)), { recursive: true });
  await fs.writeFile(path.join(root, MODELS_FILE), `${JSON.stringify({ version: 1, roles }, null, 2)}\n`);

  return { role, ...(before ? { before } : {}), ...(model ? { after: model } : {}), file: MODELS_FILE };
};
