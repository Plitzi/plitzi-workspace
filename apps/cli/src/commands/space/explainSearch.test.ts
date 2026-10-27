import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { searchAll } from './explain';
import { skillFiles } from '../../scaffold/skills';
import { skillPassages } from '../project/skillsMentions';

import type { SkillPassage } from '../project/skillsMentions';

let root = '';
let passages: SkillPassage[] = [];

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-search-'));
  for (const [file, content] of Object.entries(skillFiles())) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }

  passages = skillPassages(root);
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** A run's agents' own words, each with what answered it: the run spent 18 turns of dev-1's on the first five. */
const ASKED: [string, RegExp][] = [
  ['action step return', /server-data|ctx\.data|data-and-visibility/],
  ['task step transform lookup rows data', /server-data|ctx\.data|taskAction/],
  ['ctx.data', /ctx\.data/],
  ['read src/data in an action', /server-data|ctx\.data/],
  ['server action data', /recipes\/server-data/],
  ['function task', /taskAction|functions\.md/],
  ['descendant nested selectors', /ancestor/],
  ['accordion collapse expand', /accordion/],
  ['details summary disclosure', /accordion/],
  ['repeat list each item', /^list$/],
  ['escape key close', /^onKey$/],
  ['hash link current page', /link-to-a-section|anchor/],
  ['anchor list row', /anchor-in-row/],
  ['last-child', /^last$/]
];

describe('explain "<words>", on what agents asked', () => {
  it('answers each in its first three hits', () => {
    const ranks = ASKED.map(([words, wanted]) => {
      const hits = searchAll(words, [], 10, passages);

      return `${String(hits.findIndex(hit => wanted.test(hit.name) || wanted.test(hit.summary)) + 1)} ${words} — ${hits
        .slice(0, 3)
        .map(hit => hit.name)
        .join(' | ')}`;
    });
    expect(ranks.filter(rank => !/^[123] /.test(rank))).toEqual([]);
  });
});

// "ctx.later" was searched for five times; every passage that said "later" came back, never the member.
describe('explain "<words>", on a member named', () => {
  it('answers the member first, as the installed types declare it', () => {
    const later = {
      kind: 'api' as const,
      name: 'ctx.later',
      from: '@plitzi/sdk-server/functions',
      of: 'FunctionContext',
      summary: 'Starts one of the space’s actions in so many seconds',
      written: 'later: (request: LaterRequest) => Promise<LaterAnswer>;'
    };
    const hits = searchAll('ctx.later key replace', [], 10, passages, name => (name === 'ctx.later' ? [later] : []));

    expect(hits[0]).toEqual({ kind: 'api', name: 'ctx.later', summary: later.summary });
    expect(hits.length).toBeLessThanOrEqual(10);
  });
});

// A run's developer needed `BindingSpec` and `VisibleInput` for a helper of its own, could not name them, and grepped
// the published types.
describe('the authoring package’s types, by the words of their names and docs', () => {
  it('are found by what they are called and what their doc says', () => {
    const exported = [
      { name: 'BindingSpec', of: 'type' as const, summary: 'One binding of an element, in its long form.' },
      {
        name: 'VisibleInput',
        of: 'type' as const,
        summary: 'A visibility condition whose source may be a typed source path.'
      }
    ];

    expect(searchAll('binding spec', [], 3, [], () => [], exported)[0]?.name).toBe('BindingSpec');
    expect(searchAll('visible input', [], 3, [], () => [], exported)[0]?.name).toBe('VisibleInput');
  });
});
