import type { FeedbackFacts } from './facts';

/**
 * What the agent reads before it writes a report to Plitzi: how to find what is worth reporting, how each finding is
 * written so it can be acted on without a conversation, and how the report reaches Plitzi — published, as a link.
 */

const doctorLine = (facts: FeedbackFacts): string => {
  if (!facts.doctor) {
    return 'plitzi doctor: not run (no project plitzi create wrote here).';
  }

  if ('problem' in facts.doctor) {
    return `plitzi doctor could not look: ${facts.doctor.problem}`;
  }

  const { errors, warnings, codes } = facts.doctor;

  return `plitzi doctor: ${String(errors)} errors, ${String(warnings)} warnings${codes.length ? ` (${codes.join(', ')})` : ''}.`;
};

const previousLines = (previous: readonly string[]): string[] =>
  previous.length
    ? [
        'Earlier reports, to continue:',
        ...previous.map(url => `  - ${url}`),
        'Read each (a claude.ai artifact: open it with your artifact tool, never by fetching the URL). Number the new',
        'findings after the highest id there, and fill `changed` with every earlier finding this project touched:',
        'fixed, partly or still open — and how you saw it, on the versions above.'
      ]
    : ['No earlier report: number the findings from PZ-1.'];

export const feedbackBrief = (facts: FeedbackFacts, file: string, previous: readonly string[]): string =>
  [
    'A report to Plitzi, for the developer to send as a link.',
    '',
    `The page is ${file}: fill the REPORT object in its script and nothing else. FACTS already holds what the CLI read —`,
    'versions, Node, the project — and the page shows it; never write a version by hand.',
    '',
    `Versions: ${
      Object.entries(facts.packages)
        .map(([name, version]) => `${name} ${version}`)
        .join(', ') || `@plitzi/cli ${facts.cli}`
    }.`,
    doctorLine(facts),
    ...previousLines(previous),
    '',
    'What to report — from this conversation and this project, never guessed:',
    '- What broke, misled or cost time with Plitzi: the CLI, authoring and its checks, the SDK, the server, the',
    '  builder, the MCP, the skills and docs. Not the project’s own bugs.',
    '- Reproduce each before writing it, on the installed versions: a finding that does not reproduce is left out.',
    '- One problem per finding. Two symptoms of one cause are one finding; one symptom with two causes, two.',
    '',
    'Each finding (issues[]):',
    '- id: PZ-<n>. sev: high (blocks the work, breaks what a visitor sees, loses data, a security gap), medium (wrong',
    '  behaviour with a workaround), low (cosmetic, docs, a rough edge), improvement (works, could be better).',
    '- area: one word a team owns — Authoring, Styles, Elements, Data, Server, Auth, CLI, check, lint, Builder, MCP,',
    '  Docs, Project.',
    '- title: the defect in one sentence, as an issue title.',
    '- what: what happens, against what should. repro: the smallest code or command that shows it.',
    '- evidence: what you saw — the command and its output, a computed style, a request and its status, the file',
    '  and line of the SDK. impact: who meets it and what it costs them. workaround: what you did instead, exactly.',
    '- fix: what Plitzi could change, concretely — the API, the default, the check, the doc line.',
    '',
    'Besides the findings: `title` and `lede` (what was built and how, in a paragraph), `built` (the project in',
    'figures: pages, actions, plugins, lines, what the checks said at the end), `priorities` (the three to five to',
    'fix first, and why), `worked` (what went well — as useful to Plitzi as what did not) and `footer` (the next free',
    'id). Write in the language the developer writes in, and translate `labels` into it.',
    '',
    'Never in a report: a secret or a value from .env, a token, a cookie, a password, a customer’s data, a private',
    'URL. Write <placeholder> in their place.',
    '',
    'Then publish the file as a private artifact — in Claude Code, the Artifact tool with this file — and give the',
    'developer its URL to send to Plitzi. Where you cannot publish, tell them to open the file and share it.'
  ].join('\n');
