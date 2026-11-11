/**
 * Why a command of the CLI or a tool of the MCP did not do what it was asked — one list for both, each code with what
 * it means and what to do next. A refusal is raised with a code of this list (`fail` in the CLI, `fail` in the MCP's
 * operations), so a new one cannot leave out its next step: the code carries it. `plitzi explain <code>` answers each,
 * and `docs/en/refusals.md` is written from this table.
 *
 * A run's own refusals (a task claimed, a run stopping…) are the harness's, with exit codes of their own
 * (`REFUSAL_EXIT_CODES` in the CLI); what a space's document is refused for is authoring's (`AUTHORING_CODES`).
 */

/** The surfaces a code is raised by: the CLI's commands, the MCP's tools. */
export type RefusalSurface = 'cli' | 'mcp';

export type RefusalEntry = {
  /** What was wrong, in a line. */
  means: string;
  /** What to do next — a step, never a description. Printed with the refusal when its message names no other. */
  next: string;
  surfaces: readonly RefusalSurface[];
};

export const REFUSALS = {
  'wrong-options': {
    means: 'options given together that do not go together, or one given without the one it needs',
    next: 'change the options as the message says; the command’s --help lists what each takes',
    surfaces: ['cli', 'mcp']
  },
  'bad-value': {
    means: 'a value an option, an argument or a field does not take: not an address, not one of a list, not JSON',
    next: 'write one of the values the message names, in the shape it shows',
    surfaces: ['cli', 'mcp']
  },
  'not-a-project': {
    means: 'the command works on a project, and the folder it ran in is not one of the kind it needs',
    next: 'run it in the project’s folder: plitzi create makes one, and plitzi doctor says what a project lacks',
    surfaces: ['cli']
  },
  'old-layout': {
    means: 'the project is laid out as an older CLI left it, and this command would write it for another layout',
    next: 'run plitzi doctor --fix, which moves it with every import, then the command again',
    surfaces: ['cli']
  },
  missing: {
    means: 'what the call names is not there: a file, an element, a page, a task, a bucket',
    next: 'name one that is: the message lists them, or says where they are listed',
    surfaces: ['cli', 'mcp']
  },
  exists: {
    means: 'the place it would write already holds something it would replace',
    next: 'choose another name or place; --force replaces it, where the command takes it and the person agrees',
    surfaces: ['cli', 'mcp']
  },
  unreadable: {
    means: 'a file or an answer that could not be read as what the command takes',
    next: 'check the path, and that the file is what the message says it should be',
    surfaces: ['cli']
  },
  'does-not-build': {
    means: 'what was to be built, packed or installed did not build: its own words are in the message',
    next: 'fix what the build says, then run the command again',
    surfaces: ['cli']
  },
  'signed-out': {
    means: 'no session for the platform, or one it no longer takes',
    next: 'sign in with plitzi login, then run the command again',
    surfaces: ['cli']
  },
  'not-allowed': {
    means: 'what was asked is not this account’s, this plan’s or this surface’s to do',
    next: 'do it where the message says it is done, or ask a person whose role or plan allows it',
    surfaces: ['cli', 'mcp']
  },
  'refused-by-platform': {
    means: 'the platform refused what was sent, in its own words',
    next: 'do what the platform’s words say; when they name no fix, plitzi doctor checks the connection and the project',
    surfaces: ['cli']
  },
  'changed-since': {
    means: 'what is there changed since this copy last had it, and sending would replace that change',
    next: 'pull first (plitzi space pull), apply your change on what it brings, and send it again',
    surfaces: ['cli']
  },
  unanswered: {
    means: 'nothing answered: a server not running, an address nothing serves, a browser that did not start',
    next: 'start what the message names (npm start, plitzi server) or install it (plitzi browser install); plitzi doctor checks the machine',
    surfaces: ['cli', 'mcp']
  },
  'nobody-to-ask': {
    means: 'a choice that belongs to a person, and nobody is at the terminal to make it',
    next: 'ask the person each question the message lists, then run the command again with their answers',
    surfaces: ['cli']
  },
  'in-use': {
    means: 'what would be removed or changed is still used, or still running',
    next: 'stop or repoint what uses it first: the message names each',
    surfaces: ['cli', 'mcp']
  },
  outdated: {
    means: 'this client is older than the oldest the platform takes',
    next: 'in a project, plitzi upgrade packages (the CLI is one of them); elsewhere, npx @plitzi/cli@latest — then run the command again',
    surfaces: ['cli']
  },
  repeated: {
    means: 'the same call was refused twice before and was not run again: the answer would not change',
    next: 'change what the errors named — plitzi_describe_operation gives an operation’s fields — or ask the person what they meant',
    surfaces: ['mcp']
  },
  failed: {
    means: 'what the command ran failed on its own: a task, a step, an install',
    next: 'read the failure the message carries, fix it in the project, and run the command again',
    surfaces: ['cli']
  }
} satisfies Record<string, RefusalEntry>;

export type RefusalCode = keyof typeof REFUSALS;

export const isRefusalCode = (name: string): name is RefusalCode => Object.hasOwn(REFUSALS, name);
