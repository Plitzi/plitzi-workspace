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

// What the project uses that its space's plan leaves out, said before a push or a run finds out.
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

  // What the project's own server is told that the server hosting its space does not do: said with the value there.
  it('names what serverOptions asks that the hosting server does not give, and what it serves with its own', async () => {
    await fs.mkdir(path.join(root, 'src/config'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'src/config/serverOptions.ts'),
      'export const serverOptions = { rsc: { elementTimeoutMs: 9000 }, action: { limits: { maxRequests: 150, timeoutMs: 8000 } }, devMode: true };\n'
    );
    const runs = {
      action: { timeoutMs: 10000, maxRequests: 20 },
      functions: { cpuMs: 1000, wallMs: 5000, memoryMb: 64, outputBytes: 1048576, calls: 500 },
      sectionMs: 5000
    };
    authorizedRequest.mockResolvedValue({
      ok: true,
      value: { reply: { status: 200, data: { entitlements: { ...site, capabilities: {}, runs } } } }
    });

    const findings = await checkPlan(context());

    expect(
      findings.filter(finding => finding.code === 'server-option-above-host').map(finding => finding.message)
    ).toEqual([
      'src/config/serverOptions.ts sets rsc.elementTimeoutMs to 9000 ms, and the server hosting Café Lumen gives 5000: a section whose provider takes longer arrives empty there — read it from what a schedule keeps (`kv`).',
      'src/config/serverOptions.ts sets action.limits.maxRequests to 150 requests, and the server hosting Café Lumen gives 20: the request past it is refused there.'
    ]);
    expect(findings.find(finding => finding.code === 'server-options-own-only')?.message).toContain('`devMode`');
  });

  it('says nothing of serverOptions to a server that does not say what a run may spend', async () => {
    await fs.mkdir(path.join(root, 'src/config'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'src/config/serverOptions.ts'),
      'export const serverOptions = { devMode: true };\n'
    );
    authorizedRequest.mockResolvedValue({
      ok: true,
      value: { reply: { status: 200, data: { entitlements: { ...site, capabilities: {}, runs: { sectionMs: 'x' } } } } }
    });

    expect((await checkPlan(context())).filter(finding => finding.code.startsWith('server-option'))).toEqual([]);
  });
});
