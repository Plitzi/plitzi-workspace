/** A line the browser wrote in its console: its words, and the address it came from. */
export interface ConsoleLine {
  text: string;
  from?: string;
}

/**
 * The page's requests refused, split by whether its flow read the refusal: a request of the page's own (`fetch`,
 * `xhr`) answered 4xx while no flow of it failed is a refusal the page handled — a wrong password the sign-in says —
 * said apart, and the browser's own console line for it with it; a run's sign-in check failed on its handled 401. A
 * 5xx, a document's or a picture's refusal, or one beside a flow that failed, stays the page's failure.
 */
export const splitRefusals = ({
  requested,
  refusedFetches,
  flowFailed,
  lines,
  origin
}: {
  requested: readonly string[];
  refusedFetches: ReadonlySet<string>;
  flowFailed: boolean;
  lines: readonly ConsoleLine[];
  origin: string;
}): { failedRequests: string[]; handled: string[]; lines: ConsoleLine[] } => {
  const handled = flowFailed ? [] : requested.filter(request => refusedFetches.has(request));
  const handledAt = new Set(handled.map(request => request.slice(request.indexOf(' ') + 1)));

  return {
    failedRequests: requested.filter(request => !handled.includes(request)),
    handled,
    lines: lines.filter(
      line =>
        !(
          line.text.startsWith('Failed to load resource') &&
          line.from !== undefined &&
          handledAt.has(line.from.startsWith(origin) ? line.from.slice(origin.length) : line.from)
        )
    )
  };
};
