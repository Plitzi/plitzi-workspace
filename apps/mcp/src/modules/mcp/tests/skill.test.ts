import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { render } from '../tools/renderWidget';

import type { Operation } from '../tools/operations';

/** The skill ships next to this server and is copied into agents that never see this repo, so a stale example in
 *  it teaches every one of them something that no longer renders. Every operations batch it shows — in its core or a
 *  reference the core routes to — is rendered here, exactly as an agent would send it. */

const SKILL_DIR = fileURLToPath(new URL('../../../../skills/plitzi-render/', import.meta.url));

const skill = readFileSync(`${SKILL_DIR}SKILL.md`, 'utf8');

const references = readdirSync(`${SKILL_DIR}reference`).map(file => `reference/${file}`);

const pages = [skill, ...references.map(file => readFileSync(`${SKILL_DIR}${file}`, 'utf8'))];

const batches = pages.flatMap(page => [...page.matchAll(/```json\n([\s\S]*?)```/gu)].map(match => match[1]));

describe('plitzi-render skill', () => {
  // A reference nobody can reach is not read: the core routes to every one.
  it('routes to each of its references from the core', () => {
    expect(references.filter(file => !skill.includes(`](${file})`))).toEqual([]);
  });

  it('shows at least one complete example, since that is what weaker agents copy', () => {
    expect(batches.length).toBeGreaterThan(0);
  });

  it.each(batches.map((batch, index) => [index, batch]))('renders the example in block %i', (_index, batch) => {
    const parsed = JSON.parse(batch) as { operations: Operation[] };
    const result = render({ operations: parsed.operations });

    expect(result.rendered, JSON.stringify(result.rendered ? {} : result.errors)).toBe(true);
    if (!result.rendered) {
      return;
    }

    // Warnings are teachable, not fatal — but the example an agent copies should raise none.
    expect(result.warnings).toBeUndefined();
  });

  it('names the tool and the guide resource, which is how an agent finds either', () => {
    expect(skill).toContain('plitzi_render');
    expect(skill).toContain('plitzi://render/guide');
  });
});
