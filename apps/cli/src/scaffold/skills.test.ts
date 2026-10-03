import { posix } from 'node:path';

import { describe, expect, it } from 'vitest';

import { skillFiles } from './skills';

/** The relative links of a markdown file: `[text](path#anchor)`, without the anchor; URLs and same-page anchors aside. */
const linksOf = (markdown: string): string[] =>
  [...markdown.matchAll(/\]\(([^)\s]+)\)/g)]
    .map(match => match[1].split('#')[0])
    .filter(target => target !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(target));

/** Paths that exist in the workspace these skills are written in, and in no project they are copied into. */
const WORKSPACE_ONLY = /(?:^|[\s`(])(?:docs\/(?:en|rfc)\/|examples\/|plitzi-workspace\/)/;

/**
 * What an agent spends reading each file, in tokens — about four characters each, for English prose and code alike.
 *
 * A budget per kind of file: a skill's entry point is read every time, so it stays short and says what not to read;
 * a reference is read only when the task names its subject, so it covers one subject. `authoring-errors.md` is the
 * one page searched rather than read — by the code in brackets — and has no budget.
 */
const tokensOf = (text: string): number => Math.ceil(text.length / 4);

const budgetOf = (path: string): number | undefined => {
  if (path.endsWith('/SKILL.md')) {
    return 4000;
  }

  if (path.endsWith('/CHEATSHEET.md')) {
    return 2500;
  }

  if (path.endsWith('/authoring-errors.md')) {
    return undefined;
  }

  if (path.includes('/reference/')) {
    return 3000;
  }

  return path.includes('/recipes/') ? 1500 : undefined;
};

describe('the skills a project carries', () => {
  const files = skillFiles();
  const pages = Object.entries(files).filter(([path]) => path.endsWith('.md'));

  it('are copied whole', () => {
    expect(pages.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        '.claude/skills/plitzi-authoring/SKILL.md',
        '.claude/skills/plitzi-authoring/reference/authoring-errors.md',
        '.claude/skills/plitzi-cli/SKILL.md'
      ])
    );
  });

  it('link only to files that travel with them', () => {
    const broken = pages.flatMap(([path, content]) =>
      linksOf(content)
        .map(target => posix.normalize(posix.join(posix.dirname(path), target)))
        .filter(target => !Object.hasOwn(files, target))
        .map(target => `${path} → ${target}`)
    );

    expect(broken).toEqual([]);
  });

  it('name no file that only the workspace has', () => {
    const named = pages.flatMap(([path, content]) =>
      content
        .split('\n')
        .filter(line => WORKSPACE_ONLY.test(line))
        .map(line => `${path}: ${line.trim()}`)
    );

    expect(named).toEqual([]);
  });

  it('keep each file within what an agent should spend reading it', () => {
    const over = Object.entries(files).flatMap(([path, content]) => {
      const budget = budgetOf(path);
      const tokens = tokensOf(content);

      return budget !== undefined && tokens > budget
        ? [`${path}: ${String(tokens)} tokens, over ${String(budget)}`]
        : [];
    });

    expect(over).toEqual([]);
  });
});
