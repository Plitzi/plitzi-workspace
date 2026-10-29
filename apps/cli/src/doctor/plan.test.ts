import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkPlan } from './plan';
import { RUNTIME_ENTRY } from '../scaffold/paths';

import type { DoctorContext } from './types';
import type { SpaceOrigin } from '../commands/project/spaceOrigin';

const { currentConnection, authorizedRequest } = vi.hoisted(() => ({
  currentConnection: vi.fn(),
  authorizedRequest: vi.fn()
}));

vi.mock('../account/session', () => ({ currentConnection, authorizedRequest }));

const origin = {
  api: 'https://api.plitzi.test',
  space: { id: 4, name: 'Café Lumen', permanentUrl: 'cafe-lumen' }
} as SpaceOrigin;

const site = {
  tierLabel: 'Site',
  snapshotsKept: 10,
  analyticsDays: 90,
  capabilities: {
    cliCloud: { included: true, label: "The CLI's cloud commands" },
    functions: {
      included: false,
      label: 'Running space functions',
      requires: 'App',
      upgradeUrl: 'https://plitzi.test/pricing?space=4&plan=app'
    },
    runtime: { included: false, label: 'A runtime of the space’s own', requires: 'App+', upgradeUrl: 'https://u' }
  }
};

let root: string;
const context = (withOrigin = true) => ({ root, origin: withOrigin ? origin : undefined }) as DoctorContext;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-doctor-plan-'));
  currentConnection.mockResolvedValue({ ok: true, value: { api: origin.api } });
  authorizedRequest.mockResolvedValue({ ok: true, value: { reply: { status: 200, data: { entitlements: site } } } });
});

afterEach(async () => {
  vi.clearAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

// RFC 0029 §7.4: what the project uses that its space's plan leaves out, said before a push or a run finds out.
describe('the doctor’s plan check', () => {
  it('names what the project uses that the plan does not include, where it is and the way to it', async () => {
    await fs.mkdir(path.join(root, path.dirname(RUNTIME_ENTRY)), { recursive: true });
    await fs.writeFile(path.join(root, RUNTIME_ENTRY), 'export default {};\n');

    const findings = await checkPlan(context());

    expect(findings.map(finding => finding.code)).toEqual(['plan-excludes-runtime']);
    expect(findings[0]).toMatchObject({ severity: 'warning', file: RUNTIME_ENTRY, fix: 'Upgrade: https://u' });
    expect(findings[0]?.message).toContain("Café Lumen's plan (Site) does not include a runtime of the space’s own");
  });

  it('says nothing of a part the project does not have, nor for a project of no space', async () => {
    expect(await checkPlan(context())).toEqual([]);
    expect(await checkPlan(context(false))).toEqual([]);
    expect(currentConnection).toHaveBeenCalledTimes(1);
  });

  it('says, as information, that the plan was not checked when nobody is signed in', async () => {
    currentConnection.mockResolvedValue({ ok: true, value: undefined });

    expect(await checkPlan(context())).toEqual([
      expect.objectContaining({ severity: 'info', code: 'plan-not-checked' })
    ]);
  });
});
