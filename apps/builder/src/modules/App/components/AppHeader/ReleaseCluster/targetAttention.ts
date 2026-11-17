import type { SpaceTarget } from '@plitzi/sdk-shared';

/** One thing a target asks of a publisher, in words: what the header's dot and the draft panel say. */
export type TargetAttention = { domain: string; tone: 'danger' | 'warning' | 'progress'; words: string };

/**
 * What the space's targets need, most pressing first: a deploy that failed, one under way, a plan that
 * no longer includes the target, newer versions out, a domain not verified. A target that needs nothing says nothing.
 */
export const targetAttention = (targets: readonly SpaceTarget[]): TargetAttention[] =>
  targets
    .flatMap((target): TargetAttention[] => {
      const { domain, running, lastDeploy, locked, update, verified } = target;
      // A server of the owner's own too old for Plitzi to answer, said before anything else it asks.
      if (running) {
        return [{ domain, tone: 'progress', words: `Deploying ${running.environment} r${String(running.revision)}…` }];
      }

      if (target.required) {
        return [{ domain, tone: 'danger', words: target.required }];
      }

      if (lastDeploy?.status === 'failed') {
        return [{ domain, tone: 'danger', words: `Its last deploy failed: ${lastDeploy.error ?? 'its log says why'}` }];
      }

      if (locked) {
        return [
          {
            domain,
            tone: 'warning',
            words: `Its plan no longer includes it: it keeps serving, ${locked.requires} deploys it again`
          }
        ];
      }

      if (update) {
        return [{ domain, tone: 'warning', words: `Update available — ${update.words}` }];
      }

      return verified || target.mode === 'ssr'
        ? []
        : [{ domain, tone: 'warning', words: 'Not verified: its DNS record is not there yet' }];
    })
    .sort((a, b) => RANK[a.tone] - RANK[b.tone]);

const RANK: Record<TargetAttention['tone'], number> = { danger: 0, progress: 1, warning: 2 };

/** The colour the header's dot takes: the most pressing thing any target asks. */
export const attentionTone = (attention: readonly TargetAttention[]): TargetAttention['tone'] | undefined =>
  attention.at(0)?.tone;
