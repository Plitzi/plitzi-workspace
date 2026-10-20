import { format } from 'prettier';
import { describe, expect, it } from 'vitest';

import { formattedJson } from './formattedJson';
import { STARTER_TEAM } from '../runs/team';

/** What the projects' Prettier says of a JSON file: the scaffold's `.prettierrc`, as far as JSON reads it. */
const prettier = (text: string): Promise<string> => format(text, { parser: 'json', printWidth: 120, tabWidth: 2 });

describe('formattedJson', () => {
  it('writes JSON as the project’s Prettier leaves it: short lists on one line, objects a key a line', async () => {
    const values: unknown[] = [
      STARTER_TEAM,
      {
        version: 1,
        lead: { model: 'claude-opus-5-5', effort: 'high' },
        agents: [{ name: 'design', roles: ['designer', 'reviewer'], count: 2, model: 'claude-opus-5-5' }],
        empty: { list: [], object: {} },
        long: ['a role with a long name to push it past the line', 'another long role name', 'and a third one, longer']
      }
    ];

    for (const value of values) {
      const text = formattedJson(value);
      expect(text).toBe(await prettier(text));
    }
  });
});
