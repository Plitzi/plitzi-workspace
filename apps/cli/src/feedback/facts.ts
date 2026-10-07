import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { findProject } from '../commands/existingProject';
import { examine, projectContext } from '../doctor';
import { CLI_VERSION } from '../scaffold/project';

/**
 * What a report to Plitzi starts from, read rather than asked: the versions a finding is about, where it was seen and
 * what the project's own checks say of it. A finding without its version cannot be told fixed from open.
 */
export interface FeedbackFacts {
  /** The day, UTC: `2026-10-07`. */
  date: string;
  cli: string;
  node: string;
  /** `darwin 25.0.0 arm64`. */
  os: string;
  /** Every `@plitzi` package the project has installed, by name: what it runs, which may not be what it asks for. */
  packages: Record<string, string>;
  project?: {
    name: string;
    mode: 'server' | 'client';
    source: 'local' | 'cloud';
    runtime: boolean;
  };
  /** What `plitzi doctor` finds, in numbers and codes — or why it could not look. */
  doctor?: { errors: number; warnings: number; codes: string[] } | { problem: string };
}

const SCOPE = '@plitzi';

/** A package's `name` and `version`, from its `package.json`; nothing when it cannot be read. */
const versionOf = async (folder: string): Promise<[string, string] | undefined> => {
  try {
    const manifest: unknown = JSON.parse(await fs.readFile(path.join(folder, 'package.json'), 'utf-8'));

    return isRecord(manifest) && typeof manifest.name === 'string' && typeof manifest.version === 'string'
      ? [manifest.name, manifest.version]
      : undefined;
  } catch {
    return undefined;
  }
};

/** The `@plitzi` packages Node finds from `root`: its own `node_modules`, or a workspace's above it. */
const installedPackages = async (root: string): Promise<Record<string, string>> => {
  for (let dir = root; ; dir = path.dirname(dir)) {
    const scope = path.join(dir, 'node_modules', SCOPE);
    const names = await fs.readdir(scope).catch(() => undefined);
    if (names) {
      const versions = await Promise.all(names.sort().map(name => versionOf(path.join(scope, name))));

      return Object.fromEntries(versions.filter(entry => entry !== undefined));
    }

    if (path.dirname(dir) === dir) {
      return {};
    }
  }
};

const nameOf = async (root: string): Promise<string> => {
  try {
    const manifest: unknown = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));

    return isRecord(manifest) && typeof manifest.name === 'string' ? manifest.name : path.basename(root);
  } catch {
    return path.basename(root);
  }
};

/** The facts of the project `from` is in — what there is of them outside one: the CLI, Node and the machine. */
export const feedbackFacts = async (from: string, now: Date = new Date()): Promise<FeedbackFacts> => {
  const base: FeedbackFacts = {
    date: now.toISOString().slice(0, 10),
    cli: CLI_VERSION,
    node: process.version,
    os: `${os.platform()} ${os.release()} ${os.arch()}`,
    packages: {}
  };
  const project = await findProject(from);
  if (!project) {
    return base;
  }

  const packages = await installedPackages(project.root);
  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  if (!plitzi) {
    return { ...base, packages };
  }

  const facts: FeedbackFacts = {
    ...base,
    packages,
    project: { name: await nameOf(project.root), mode: plitzi.mode, source: plitzi.source, runtime: plitzi.runtime }
  };
  const context = await projectContext(project);
  if ('problem' in context) {
    return { ...facts, doctor: { problem: context.problem } };
  }

  const { findings } = await examine(context);
  const counted = findings.filter(finding => finding.severity !== 'info');

  return {
    ...facts,
    doctor: {
      errors: counted.filter(finding => finding.severity === 'error').length,
      warnings: counted.filter(finding => finding.severity === 'warning').length,
      codes: [...new Set(counted.map(finding => finding.code))].sort()
    }
  };
};
