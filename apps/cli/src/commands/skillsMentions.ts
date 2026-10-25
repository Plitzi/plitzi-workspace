import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Where the project's skills write a name — the reference that says how it is used, and the recipe that shows it:
 * `explain` of an export points at them, so a reader goes to the page that teaches it rather than the published types
 * (a run's dev-1 read the `.d.ts` for `taskAction`, which the functions reference teaches with an example).
 */

export interface SkillMention {
  /** The file, from the project's root: `.claude/skills/plitzi-authoring/reference/data-and-visibility.md`. */
  file: string;
  line: number;
  text: string;
}

const SKILLS_DIR = path.join('.claude', 'skills');

/** The mentions said, at most: the first ones, references before recipes. */
const MENTIONS_SAID = 4;

/** The skills' pages and recipes, references first: where a name is taught before where it is only used. */
const skillFiles = (root: string): string[] => {
  const dir = path.join(root, SKILLS_DIR);
  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir, { recursive: true, encoding: 'utf-8' }).filter(
    file => file.endsWith('.md') || file.endsWith('.ts')
  );

  return files.sort((a, b) => Number(b.includes('reference')) - Number(a.includes('reference')) || a.localeCompare(b));
};

/** The lines of the skills that write `name` as code — called, or between backticks — the first few. */
export const skillsMentions = (root: string, name: string): SkillMention[] => {
  if (!/^[\w$]+$/.test(name)) {
    return [];
  }

  const escaped = name.replace(/\$/g, '\\$');
  const written = new RegExp(`(?<![\\w$.])${escaped}\\(|\`${escaped}[\`(]`);
  const mentions: SkillMention[] = [];
  for (const file of skillFiles(root)) {
    const lines = readFileSync(path.join(root, SKILLS_DIR, file), 'utf-8').split('\n');
    const at = lines.findIndex(line => written.test(line));
    if (at !== -1) {
      mentions.push({ file: path.join(SKILLS_DIR, file), line: at + 1, text: lines[at].trim().slice(0, 140) });
    }

    if (mentions.length >= MENTIONS_SAID) {
      break;
    }
  }

  return mentions;
};

/** One passage of a skill a search may answer with: a heading or a point of a reference, or a recipe. */
export interface SkillPassage {
  kind: 'skill';
  /** Where it is: the file from the project's root, and its line. */
  name: string;
  /** What it says first, as a search lists it. */
  summary: string;
  /** What it is about — a reference's heading or point in bold, a recipe's name — weighed as a name is. */
  title: string;
  /** All it says — its lines up to the next point — what a search reads it by. */
  text: string;
}

/** How much of a passage a search says: its point, not its paragraph. */
const PASSAGE_CHARS = 160;

/** A heading, or a point of a list, starting a line. */
const POINT = /^\s*(?:#{2,4}|[-*])\s+/;

/**
 * What a point is about: a heading's words, what it says in bold, or the name it starts with in code — `ancestors: { … }`
 * is about `ancestors`. The point that teaches `ancestors` was a plain one, and no search read it.
 */
const pointOf = (line: string): string =>
  /^\s*#{2,4}\s+(.*)$/.exec(line)?.[1] ??
  /\*\*(.+?)\*\*/.exec(line)?.[1] ??
  /^\s*[-*]\s+`([\w$-]+)/.exec(line)?.[1] ??
  '';

/** A reference's headings and points, each with the lines that go on with it. */
const referencePassages = (root: string, file: string): SkillPassage[] => {
  const lines = readFileSync(path.join(root, SKILLS_DIR, file), 'utf-8').split('\n');

  return lines.flatMap((line, index): SkillPassage[] => {
    if (!POINT.test(line)) {
      return [];
    }

    const rest = lines.slice(index + 1);
    const ends = rest.findIndex(next => next.trim() === '' || POINT.test(next));
    const text = [line, ...(ends === -1 ? rest : rest.slice(0, ends))]
      .join(' ')
      .replace(/^\s*(?:#{2,4}|[-*])\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return [
      {
        kind: 'skill',
        name: `${path.join(SKILLS_DIR, file)}:${String(index + 1)}`,
        summary: text.slice(0, PASSAGE_CHARS),
        title: pointOf(line),
        text
      }
    ];
  });
};

/** A recipe, by what its first comment says it shows and by its name: `accordion.ts` is an accordion. */
const recipePassage = (root: string, file: string): SkillPassage[] => {
  const source = readFileSync(path.join(root, SKILLS_DIR, file), 'utf-8');
  const comment = /^\s*\/\*\*([\s\S]*?)\*\//.exec(source)?.[1];
  if (comment === undefined) {
    return [];
  }

  const text = comment
    .replace(/^\s*\*\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  return [
    {
      kind: 'skill',
      name: path.join(SKILLS_DIR, file),
      summary: text.slice(0, PASSAGE_CHARS),
      title: path.basename(file, '.ts').replace(/-/g, ' '),
      text
    }
  ];
};

/**
 * The skills as passages a search reads — each heading and point of a reference with the lines that go on with it, and
 * each recipe by its comment — so `explain --search` answers what the skills teach beside what the catalogues hold:
 * A run's "server action reads a data file for a provider" found neither `ctx.data` nor `taskAction`, both taught
 * in the functions reference, and "accordion collapse expand" nothing, beside `recipes/accordion.ts`.
 */
export const skillPassages = (root: string): SkillPassage[] =>
  skillFiles(root).flatMap(file =>
    file.endsWith('.md') && file.includes('reference')
      ? referencePassages(root, file)
      : file.endsWith('.ts') && file.includes('recipes')
        ? recipePassage(root, file)
        : []
  );
