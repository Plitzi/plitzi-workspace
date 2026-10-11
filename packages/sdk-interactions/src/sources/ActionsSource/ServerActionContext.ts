import { sharedContext } from '@plitzi/sdk-shared/helpers/sharedContext';

/**
 * Where a run stands as its caller hears it: how an awaited one ended (`completed`, `failed`, `aborted`, or `skipped`
 * where no server runs actions), or that a detached one was `accepted` and a streamed one is `streaming`.
 */
export type ServerActionStatus = 'completed' | 'failed' | 'skipped' | 'aborted' | 'accepted' | 'streaming';

const ENDED: readonly ServerActionStatus[] = ['completed', 'failed', 'skipped', 'aborted'];

/**
 * How the server said an awaited run ended — read from its JSON, so a word it never uses is a run that did not
 * complete, never one that did.
 */
export const endedStatusOf = (status: string | undefined): ServerActionStatus =>
  status === undefined ? 'completed' : (ENDED.find(ended => ended === status) ?? 'failed');

/** What a run of a server action answers whoever started it — a flow's `runServerAction` step, or a plugin's `useServerAction`. */
export type ServerActionAnswer = {
  status: ServerActionStatus;
  runId: string;
  output: Record<string, unknown>;
  /** The server's word for a run it refused or that failed: `forbidden`, `invalid_input`, `duplicate`… */
  reason?: string;
  /** Said for the caller, by a step that refused with a reason written for them. */
  error?: string;
  accepted?: boolean;
};

/** One awaited run of an action, as the `runServerAction` step makes it. */
export type RunServerAction = (request: {
  actionId: string;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  /**
   * Whether a completed run refreshes the page's cached requests — `all`, the default, since what it wrote is the
   * server's to know — or none, for an action that only reads.
   */
  invalidateQueries?: 'all' | 'none';
}) => Promise<ServerActionAnswer>;

/** Present wherever the page runs actions; absent, nothing on this page can (the builder's canvas, an offline render). */
export const ServerActionContext = sharedContext<RunServerAction | undefined>('ServerActionContext', undefined);
