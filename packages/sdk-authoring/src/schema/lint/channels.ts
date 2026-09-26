import { channelProblems, matchChannel } from '@plitzi/sdk-shared/realtime';

import type { LintContext } from './context';

/** What a `{{ … }}` in a topic stands for when it is checked: one segment, as a page will fill it in. */
const SAMPLE_SEGMENT = 'x';

/**
 * A `channel` element whose topic no channel of the space covers: the server refuses it, and the page shows a
 * channel that never connects. Its templated parts (`board:{{ id }}`) are checked as the segment they become.
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

    const sample = topic.replace(/\{\{[^}]*\}\}/g, SAMPLE_SEGMENT);
    if (!matchChannel(sample, declared)) {
      ctx.error(
        'channel-topic',
        patterns.length
          ? `${where} opens "${topic}", which none of the space's channels covers (${patterns.map(pattern => `"${pattern}"`).join(', ')}). Use a topic one of them matches, or declare it in \`channels\`.`
          : `${where} opens "${topic}", but the space declares no channels. Declare one at the top of the space: \`channels: { 'board:{id}': { access: { mode: 'public' } } }\`.`,
        element.id
      );
    }
  }
};
