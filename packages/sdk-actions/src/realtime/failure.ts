/**
 * What a realtime promise nobody waits on does when the pub/sub under it fails — Redis timing out under load: it says so
 * and the server goes on. Left to reject, it reached the process's `unhandledRejection` handler, which shuts the whole
 * server down over one undelivered cursor.
 */
export const warnRealtime =
  (what: string) =>
  (error: unknown): void => {
    console.warn(`[Realtime] ${what}:`, error instanceof Error ? error.message : error);
  };
