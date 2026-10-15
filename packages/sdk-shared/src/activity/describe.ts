import type { SpaceActivity } from './types';

const ORIGIN_WORDS: Record<string, string> = {
  builder: 'in the builder',
  mcp: 'over the MCP',
  autofix: 'by the autofix',
  api: 'through the API',
  system: 'by the platform'
};

const byWhom = (name: string): string => name || 'somebody';

/** The first line of a change's summary, and how many more it has. */
const headline = (summary: string): string => {
  const lines = summary.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) {
    return 'changed it';
  }

  return lines.length === 1 ? lines[0] : `${lines[0]} (+${String(lines.length - 1)} more)`;
};

/**
 * One activity, in a line a person scans: who did what, and where — the same words the builder's history and activity
 * use. Its time is the reader's to add, in the zone it shows times in.
 */
export const activityLine = (activity: SpaceActivity): string => {
  switch (activity.kind) {
    case 'change': {
      // An agent is named by its application, for the member it writes for — as the builder shows it. A builder
      // change's `client` is a tab's id, which names nobody.
      const who =
        activity.origin === 'mcp' && activity.client
          ? `${activity.client} for ${byWhom(activity.author.name)}`
          : byWhom(activity.author.name);

      return `${who} ${ORIGIN_WORDS[activity.origin] ?? activity.origin}, ${activity.document} #${String(activity.seq)}: ${headline(activity.summary)}`;
    }
    case 'publish':
      return activity.message;
    case 'action': {
      const why = activity.reason ?? activity.error;

      return `action ${activity.actionId} (${activity.trigger}) ${activity.status}${why ? `: ${why}` : ''}`;
    }
  }
};
