import { evidenceOf } from './types';
import { wordsOf } from './words';

import type { Finding } from './types';
import type { UsageLine } from '../core/usage';

/**
 * What the agents asked `explain` — and where Plitzi had no answer, or several tries found one: a run's ten misses
 * (`authSignup`, `chart`, `timeago`…) were each a gap the platform then filled, and dev-1 asked about dialogs eight
 * ways. The questions themselves are the evidence: what an agent looks for, in its words.
 */

/** One agent asking about a topic in this many different ways did not find it the first time. */
const WAYS = 3;

const askedOf = (line: UsageLine): string => line.args.join(' ');

export const explainFindings = (usage: readonly UsageLine[]): Finding[] => {
  const asked = usage.filter(line => line.name === 'explain' && !line.options.includes('--list'));
  const missed = asked.filter(line => line.code !== 0);
  const findings: Finding[] = [];
  if (missed.length > 0) {
    findings.push({
      kind: 'explain-missed',
      owner: 'plitzi',
      area: 'docs',
      title: `explain had no answer for ${String(missed.length)} question(s)`,
      evidence: evidenceOf(missed.map(line => `${line.by}: ${askedOf(line)}`)),
      times: missed.length,
      fix: 'each is a name, a passage or a feature Plitzi lacks — or a word explain should know it by',
      subject: 'explain-missed'
    });
  }

  // A topic one agent asked about in several ways is one it did not find: dev-1's dialogs (dialogContainer, openDialog,
  // modalContainer, "dialog sheet modal"). Three agents each looking `formControl` up once is explain being used.
  const byWord = new Map<string, { questions: Set<number>; ways: Map<string, Set<string>> }>();
  // An entry read by its name after a search that listed it is the answer read whole, not another try: a scout's
  // "self-hosted font file", then HostedFont and RemoteFont from its list, read as three ways of asking for fonts.
  const searched = new Map<string, Set<string>>();
  asked.forEach((line, index) => {
    const question = askedOf(line).replace(/--search\s*/, '');
    const words = wordsOf(question);
    const byName = line.code === 0 && !/\s/.test(question.trim()) && !line.options.includes('--search');
    const found = searched.get(line.by) ?? new Set<string>();
    if (byName && [...words].some(word => found.has(word))) {
      return;
    }

    if (line.code === 0 && !byName) {
      searched.set(line.by, new Set([...found, ...words]));
    }

    for (const word of words) {
      const kept = byWord.get(word) ?? { questions: new Set<number>(), ways: new Map<string, Set<string>>() };
      kept.questions.add(index);
      kept.ways.set(line.by, (kept.ways.get(line.by) ?? new Set<string>()).add(question));
      byWord.set(word, kept);
    }
  });
  const topics = [...byWord].filter(([, kept]) => [...kept.ways.values()].some(ways => ways.size >= WAYS));
  // A word always asked with another (`dialog` in every `modal` question) is that topic's, said once.
  const kept = topics.filter(
    ([word, { questions }]) =>
      !topics.some(
        ([other, more]) =>
          other !== word &&
          (more.questions.size > questions.size || (more.questions.size === questions.size && other < word)) &&
          [...questions].every(each => more.questions.has(each))
      )
  );
  const sorted = kept.sort((a, b) => b[1].questions.size - a[1].questions.size);
  if (sorted.length > 0) {
    findings.push({
      kind: 'explain-topic',
      owner: 'plitzi',
      area: 'docs',
      title: `Topics explain did not answer the first time: ${sorted.map(([word]) => `“${word}”`).join(', ')}`,
      evidence: evidenceOf(
        sorted.map(([word, { questions }]) => {
          const lines = [...questions].map(index => asked[index]);
          const ways = [...new Set(lines.map(line => askedOf(line).replace(/--search\s*/, '')))];

          return `${word} ×${String(questions.size)} (${[...new Set(lines.map(line => line.by))].join(', ')}): ${ways.slice(0, 5).join(' · ')}${ways.length > 5 ? ' · …' : ''}`;
        })
      ),
      times: sorted.reduce((sum, [, { questions }]) => sum + questions.size, 0),
      fix: 'for each, one entry or skill passage that answers it the first time, under the words the agents used',
      subject: 'explain-topic'
    });
  }

  return findings;
};
