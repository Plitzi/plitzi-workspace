import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { render } from '../tools/render';

import type { Operation } from '../tools/operations';

/** The skill ships next to this server and is copied into agents that never see this repo, so a stale example in
 *  it teaches every one of them something that no longer renders. Every operations batch it shows is rendered
 *  here, exactly as an agent would send it. */

const SKILL_PATH = fileURLToPath(new URL('../../../../skills/plitzi-render/SKILL.md', import.meta.url));

const skill = readFileSync(SKILL_PATH, 'utf8');

const batches = [...skill.matchAll(/```json\n([\s\S]*?)```/gu)].map(match => match[1]);

describe('plitzi-render skill', () => {
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
