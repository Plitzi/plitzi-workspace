import { z } from 'zod';

import { defineTool } from './shared/tool';

import type { ToolContext } from './shared/tool';

/**
 * A space's releases (RFC 0034), for an agent as for a person: what each domain serves and what a rollback would put
 * back, a domain's history, a publish and a rollback — held on the platform to the same rules as the builder's Publish
 * (who may publish, the plan, the revision's tests), a refusal answered in its words.
 */

const environment = z.enum(['main', 'development', 'staging', 'production']);

const notWired = { done: false, reason: 'This deployment keeps no releases for its spaces' } as const;

export const releasesTool = defineTool({
  name: 'plitzi_releases',
  title: 'Space releases',
  description:
    'Every domain of the space with the revision it serves and what a rollback would put back — or, with `domain`, ' +
    'that domain’s releases, newest first: what each put on it, who, when, publish or rollback.',
  inputShape: { domain: z.string().optional().describe('One domain’s history; every domain when left out') },
  access: 'read',
  documents: false,
  run: async ({ domain }, ctx: ToolContext) => {
    if (!ctx.releases) {
      return notWired;
    }

    return domain ? ctx.releases.history(domain) : { domains: await ctx.releases.domains() };
  }
});

export const publishTool = defineTool({
  name: 'plitzi_publish',
  title: 'Publish a revision',
  description:
    'Point a domain at a revision — its environment’s latest unless `revision` names one — recorded as a release. ' +
    'Live at once for the visitors of that domain: publish only what the person asked to be published.',
  inputShape: {
    domain: z.string().describe('One of the space’s domains'),
    environment: environment.describe('The revision’s environment; `main` serves the draft as it is saved'),
    revision: z.number().int().positive().optional().describe('The revision; the environment’s latest when left out')
  },
  access: 'write',
  documents: false,
  run: (asked, ctx: ToolContext) => (ctx.releases ? ctx.releases.publish(asked) : notWired)
});

export const rollbackTool = defineTool({
  name: 'plitzi_rollback',
  title: 'Roll a domain back',
  description:
    'Put back on a domain what it served right before its latest release — or the version `to` names from its ' +
    'history. Never refused by plan. Feature flags and the space’s data stay as they are.',
  inputShape: {
    domain: z.string().describe('One of the space’s domains'),
    to: z
      .object({ environment, revision: z.number().int().nonnegative() })
      .optional()
      .describe('A version from its history; what it served right before its latest release when left out')
  },
  access: 'write',
  documents: false,
  run: (asked, ctx: ToolContext) => (ctx.releases ? ctx.releases.rollback(asked) : notWired)
});
