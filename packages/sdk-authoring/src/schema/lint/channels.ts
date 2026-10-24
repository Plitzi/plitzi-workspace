import { channelProblems, jobOfTopic, matchChannel } from '@plitzi/sdk-shared/realtime';

import type { LintContext } from './context';

/** What a `{{ … }}` in a topic stands for when it is checked: one segment, as a page will fill it in. */
const SAMPLE_SEGMENT = 'x';

/** `{{ cond ? 'a' : 'b' }}`: a part that is one of two words the template names. */
const CHOICE = /^[^?'"]+\?\s*(['"])([^'"]*)\1\s*:\s*(['"])([^'"]*)\3\s*$/;

/** Past this many topics a template can become, it is not read out: the server still checks what a page opens. */
const MOST_TOPICS = 16;

/**
 * Every topic a templated one can become, as far as it can be told here: a plain `{{ id }}` is one segment, a choice
 * `{{ room.locked ? 'vault' : 'room' }}` either word (encore's private rooms: the prefix was refused, read as one
 * sample segment). `undefined` when a part is anything else written in words — `{{ 'room:' ~ id }}`, a filter — which
 * only the page decides, as a bound topic is.
 */
const topicsOf = (topic: string): string[] | undefined => {
  let topics = [''];
  for (const [index, part] of topic.split(/\{\{([^}]*)\}\}/).entries()) {
    if (index % 2 === 0) {
      topics = topics.map(each => each + part);
      continue;
    }

    const choice = CHOICE.exec(part);
    if (!choice && /['"~|]/.test(part)) {
      return undefined;
    }

    const words = choice ? [choice[2], choice[4]] : [SAMPLE_SEGMENT];
    topics = topics.flatMap(each => words.map(word => each + word));
    if (topics.length > MOST_TOPICS) {
      return undefined;
    }
  }

  return topics;
};

/**
 * A `channel` element whose topic no channel of the space covers — or a private one's, with no grant to open it: the
 * server refuses it, and the page shows a channel that never connects. Its templated parts (`board:{{ id }}`) are checked as the segment they become.
 */
export const lintChannels = (ctx: LintContext): void => {
  const declared = ctx.schema.settings.channels;
  const patterns = Object.keys(declared ?? {});
  // The declarations themselves, as the builder or an agent wrote them: one the server could not read opens nothing.
  for (const pattern of patterns) {
    for (const problem of channelProblems(pattern, declared?.[pattern])) {
      ctx.error('channel-declaration', `Channel "${pattern}": ${problem}.`);
    }
  }

  for (const element of Object.values(ctx.flat)) {
    if (element.definition.type !== 'channel') {
      continue;
    }

    // A topic written by a binding is decided on the page — the board a route names, a secret an action answered —
    // and there is nothing here to check it against. The server still refuses it if no channel covers it.
    if (element.definition.bindings?.attributes?.some(binding => binding.to === 'topic')) {
      continue;
    }

    const where = ctx.describe(element.id);
    const topic = typeof element.attributes.topic === 'string' ? element.attributes.topic.trim() : '';
    if (!topic) {
      ctx.error(
        'channel-topic',
        `${where} names no topic. Give it one a channel of the space covers: \`topic: 'board:{{ id }}'\`.`,
        element.id
      );
      continue;
    }

    // Written so only the page knows what it becomes: as a bound topic, nothing here to check it against.
    const samples = topicsOf(topic);
    if (samples === undefined) {
      continue;
    }

    // A job's topic is the platform's: the job says who may watch it, and no channel of the space has to.
    if (samples.some(sample => jobOfTopic(sample) !== undefined)) {
      continue;
    }

    const matches = samples.map(sample => matchChannel(sample, declared));
    const uncovered = samples.find((_, index) => matches[index] === undefined);
    const hasGrant =
      (typeof element.attributes.grant === 'string' && element.attributes.grant.trim() !== '') ||
      element.definition.bindings?.attributes?.some(binding => binding.to === 'grant') === true;
    const match = matches.find(each => each?.declaration.grant === true);
    if (match && !hasGrant) {
      ctx.error(
        'channel-grant',
        `${where} opens "${topic}", a topic of the private channel "${match.pattern}" (\`grant: true\`), with no grant — the server refuses it every time. Bind \`grant\` to what the action that lets the visitor in returns from its \`realtime.grant\` step.`,
        element.id
      );
    }

    if (uncovered !== undefined) {
      const which = samples.length > 1 ? ` — as "${uncovered}"` : '';
      ctx.error(
        'channel-topic',
        patterns.length
          ? `${where} opens "${topic}"${which}, which none of the space's channels covers (${patterns.map(pattern => `"${pattern}"`).join(', ')}). Use a topic one of them matches, or declare it in \`channels\`.`
          : `${where} opens "${topic}", but the space declares no channels. Declare one at the top of the space: \`channels: { 'board:{id}': { access: { mode: 'public' } } }\`.`,
        element.id
      );
    }
  }
};
