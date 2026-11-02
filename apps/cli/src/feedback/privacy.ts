import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AUTHORING_CODES } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { projectSpace } from '../commands/page/check/space';
import { REFUSAL_EXIT_CODES } from '../runs/core/refusal';

/**
 * What a report to Plitzi leaves out — `plitzi feedback`'s and a run's `feedback.md` alike: nothing of the person, and
 * nothing of the project — its name, its people, its addresses, its files, its element and task names — only how Plitzi
 * behaved (the maintainer: a report to Plitzi carries no personal data nor the project's; when one must, the person is told
 * before it is sent). What can be told apart by its shape or by the project's own names is written over
 * (`scrubbed`); what cannot — a sentence quoted from a page — is listed for the person to read before sending
 * (`leftToCheck`).
 */

export interface PrivateWords {
  /** The names the project goes by: its package's, its space's name and address, its folder's. */
  names: string[];
  /** The person's: this machine's user, and git's name and email. */
  person: string[];
  /**
   * The names the project chose for what it draws: the space's element ids that are its own by their shape — a dash, a
   * digit, two words run together, never `hero` — and its plugins, by folder and by type (`VzButton`, `vzButton`).
   */
  elements: string[];
  /** A run's task ids, in its plan's order: written `task-1`, `task-2`… */
  tasks: string[];
}

/**
 * Plitzi's own words — what a refusal or a finding is called (`not-found`, `unused-file`): never the project's, even
 * where the project named an element alike.
 */
const PLITZI_WORDS: ReadonlySet<string> = new Set([
  ...Object.keys(REFUSAL_EXIT_CODES),
  ...Object.keys(AUTHORING_CODES)
]);

/** An id the project chose rather than a word of English or of Plitzi: `plan-card-root`, `heroTitle`, `card2`. */
const isDistinctive = (id: string): boolean => id.length >= 4 && /[-_\d]|[a-z][A-Z]/.test(id) && !PLITZI_WORDS.has(id);

const packageName = async (root: string): Promise<string | undefined> => {
  try {
    const manifest: unknown = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));

    return isRecord(manifest) && typeof manifest.name === 'string' ? manifest.name : undefined;
  } catch {
    return undefined;
  }
};

/** The `[user]` name and email of a git config file, when it has them. */
const gitUser = async (file: string): Promise<string[]> => {
  const text = await fs.readFile(file, 'utf-8').catch(() => '');
  const user = /^\[user\]([\s\S]*?)(?=^\[|$(?![\s\S]))/m.exec(text)?.[1] ?? '';

  return [...user.matchAll(/^\s*(?:name|email)\s*=\s*(.+?)\s*$/gm)].map(match => match[1]);
};

/** What names the project and the person, read off the project at `root` and this machine. */
export const privateWords = async (
  root: string,
  {
    tasks = [],
    files = [],
    run
  }: {
    /** A run's task ids, in its plan's order. */
    tasks?: readonly string[];
    /** The files its plan names: a plugin it made and removed is named by its folder there. */
    files?: readonly string[];
    /** The run's id, which its lead named after the project (`nimbo-site`). */
    run?: string;
  } = {}
): Promise<PrivateWords> => {
  const space = await projectSpace(root).catch(() => undefined);
  const authored = space && !('problem' in space) ? space : undefined;
  const scoped = await packageName(root);
  const names = [
    scoped,
    scoped?.replace(/^@[^/]+\//, ''),
    authored?.schema.definition.name,
    authored?.schema.definition.permanentUrl,
    path.basename(root),
    run
  ].filter((name): name is string => name !== undefined && name.length >= 3);
  const person = [
    os.userInfo().username,
    ...(await gitUser(path.join(root, '.git', 'config'))),
    ...(await gitUser(path.join(os.homedir(), '.gitconfig')))
  ].filter(word => word.length >= 3);
  const plugins = [
    ...new Set([
      ...(await fs.readdir(path.join(root, 'src', 'plugins')).catch(() => [])),
      ...files.flatMap(file => /^src\/plugins\/([^/]+)\//.exec(file)?.[1] ?? [])
    ])
  ];
  const elements = [
    // The pages' tree and each component's, its own: ids are one namespace across them.
    ...(authored
      ? [
          ...Object.keys(authored.schema.flat),
          ...Object.values(authored.schema.components).flatMap(each => [each.id, ...Object.keys(each.flat)])
        ]
      : []),
    ...plugins,
    ...plugins.map(folder => `${folder.charAt(0).toLowerCase()}${folder.slice(1)}`)
  ].filter(id => isDistinctive(id) && !id.startsWith('plitzi-'));

  // Each once, whatever its case: matched regardless of it.
  const once = (list: readonly string[]): string[] =>
    list.filter((word, index) => list.findIndex(each => each.toLowerCase() === word.toLowerCase()) === index);

  return {
    names: once(names),
    person: once(person),
    elements: [...new Set(elements)],
    tasks: [...tasks]
  };
};

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `word` where it stands alone — not inside a longer name — whatever its case. */
const alone = (word: string): RegExp =>
  // A class built on it (`vzButton--liquid`, `card__title`) names it too.
  new RegExp(`(?<![\\w@.-])${escaped(word)}(?!(?!--|__)[\\w-])`, 'gi');

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Its last character no sentence's punctuation: `at http://…/pricing, published` keeps its comma.
const URL_ANY = /\bhttps?:\/\/[^\s)'"`<>\]]*[^\s)'"`<>\],.;:!?]/g;
/** Plitzi's own addresses, which say nothing of the project: its docs, its site, a space's plitzi.app host is not. */
const PLITZI_HOST = /^(?:www\.|docs\.)?plitzi\.com$/;
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/;
/** A folder of someone's machine — under a home, written whole or as `~` — whatever follows it. */
const MACHINE_PATH = /(?<![\w./-])(?:~|\/(?:Users|home)\/[^\s/'"`)]+)(?:\/[^\s'"`)\]]*)?/g;
/** What reads as a task's id the plan does not have — one cut short, or two run together: the run's own `t-` ids. */
const TASK_LIKE = /(?<![\w-])t-[a-z0-9][\w-]{2,}/g;
const IPV4 = /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/g;
const NOT_PRIVATE_IP = new Set(['127.0.0.1', '0.0.0.0']);
/** A project's file: what Plitzi lays out kept (`src/plugins/`), what the project named written over. */
const PROJECT_PATH = /(?<![\w.-])src\/[\w./-]*[\w-]/g;
const LAYOUT_SEGMENTS: ReadonlySet<string> = new Set([
  'src',
  'space',
  'pages',
  'components',
  'layouts',
  'plugins',
  'functions',
  'actions',
  'data',
  'runtime',
  'config',
  'tests'
]);
const PLITZI_FILES: ReadonlySet<string> = new Set(['index', 'declaration', 'Settings', 'serverOptions', 'theme']);

const scrubbedUrl = (url: string): string => {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return '<url>';
  }

  return PLITZI_HOST.test(host) ? url : LOCAL_HOST.test(host) ? '<local url>' : '<url>';
};

const scrubbedPath = (file: string): string =>
  file
    .split('/')
    .map(segment => {
      const [stem = '', ...rest] = segment.split('.');
      const extension = rest.length > 0 ? `.${rest.join('.')}` : '';

      return LAYOUT_SEGMENTS.has(segment) || PLITZI_FILES.has(stem) ? segment : `<name>${extension}`;
    })
    .join('/');

/**
 * `text` with what names the person or the project written over: an email, an address not Plitzi's, an IP, the
 * project's and the person's names, a file of the project past what Plitzi lays out, a task by its place, an element
 * the project named. What it cannot tell by shape or name is left, for `leftToCheck`.
 */
export const scrubbed = (text: string, words: PrivateWords): string => {
  let clean = text
    .replace(EMAIL, '<email>')
    .replace(URL_ANY, scrubbedUrl)
    .replace(MACHINE_PATH, '<path>')
    .replace(IPV4, ip => (NOT_PRIVATE_IP.has(ip) ? ip : '<ip>'))
    .replace(PROJECT_PATH, scrubbedPath);
  const byLength = (list: readonly string[]) => [...list].sort((a, b) => b.length - a.length);
  // Tasks first, by their place in the plan: an element named like a task is the task's.
  const places = new Map(words.tasks.map((task, index) => [task, `task-${String(index + 1)}`]));
  for (const task of byLength(words.tasks)) {
    clean = clean.replace(alone(task), places.get(task) ?? '<task>');
  }

  clean = clean.replace(TASK_LIKE, '<task>');

  for (const [list, as] of [
    [words.names, '<project>'],
    [words.person, '<person>'],
    [words.elements, '<element>']
  ] as const) {
    for (const word of byLength(list)) {
      clean = clean.replace(alone(word), as);
    }
  }

  return clean;
};

/** A passage quoted in a text — a page's words, a label — long enough to be the project's own. */
const QUOTED = [
  /["“«]([^"“”«»\n]{12,160})["”»]/g,
  // Single quotes only where they open and close a passage: an apostrophe (`the agent's`) opens none.
  /(?<!\w)['‘]([^'‘’\n]{12,160})['’](?!\w)/g
];

/**
 * What may still be the project's once `scrubbed`, for the person to read before sending: the passages quoted — a
 * page's copy, a name in a sentence — that are no command and no code. Each once, the first `most`.
 */
export const leftToCheck = (text: string, most = 12): string[] => {
  const found = new Set<string>();
  for (const match of QUOTED.flatMap(quoted => [...text.matchAll(quoted)])) {
    const said = match[1].trim();
    const command = /^(?:plitzi|npm|npx|yarn|node)\b|--|[{}()=;<>]|^[\w.-]+$/.test(said);
    if (!command && said.includes(' ')) {
      found.add(said);
    }
  }

  return [...found].slice(0, most);
};

/**
 * What of the person or the project a text holds, each said once with what it is — `an email: ana@acme.dev`, `the
 * project's name: nimbo` — for a report an agent writes (`plitzi feedback --check`): written over by the agent, or
 * agreed with the person before it is sent. `agreed` are those the person agreed to: not said again.
 */
export const privateIn = (text: string, words: PrivateWords, agreed: readonly string[] = []): string[] => {
  const found: string[] = [];
  const say = (what: string, value: string): void => {
    const line = `${what}: ${value}`;
    const bare = value.replace(/^“|”$/g, '').toLowerCase();
    if (!agreed.some(each => each.trim().toLowerCase() === bare) && !found.includes(line)) {
      found.push(line);
    }
  };
  for (const email of text.match(EMAIL) ?? []) {
    say('an email', email);
  }

  for (const url of text.match(URL_ANY) ?? []) {
    if (scrubbedUrl(url) !== url) {
      say('an address', url);
    }
  }

  for (const folder of text.match(MACHINE_PATH) ?? []) {
    say('a folder of the machine', folder);
  }

  for (const ip of text.match(IPV4) ?? []) {
    if (!NOT_PRIVATE_IP.has(ip)) {
      say('an IP', ip);
    }
  }

  for (const file of text.match(PROJECT_PATH) ?? []) {
    if (scrubbedPath(file) !== file) {
      say('a file of the project', file);
    }
  }

  for (const [list, what] of [
    [words.names, 'the project’s name'],
    [words.person, 'the person’s'],
    [words.elements, 'an element the project named'],
    [words.tasks, 'a task of the project']
  ] as const) {
    for (const word of list) {
      if (alone(word).test(text)) {
        say(what, word);
      }
    }
  }

  for (const quoted of leftToCheck(text)) {
    say('words quoted, maybe the project’s', `“${quoted}”`);
  }

  return found;
};
