/** A request, as `answerAction` reads it — a Playwright `Request` is one. */
export interface AnsweredRequest {
  method(): string;
  postData(): string | null;
  headers(): Record<string, string>;
}

/** A routed request, as `answerAction` answers it — a Playwright `Route` is one. */
export interface AnsweredRoute {
  request(): AnsweredRequest;
  fulfill(response: { status?: number; contentType?: string; body: string }): Promise<void>;
  fallback(): Promise<void>;
}

/** What `answerAction` needs of a page — a Playwright `Page` is one. */
export interface RoutingPage {
  route(url: string, handler: (route: AnsweredRoute) => Promise<void>): Promise<void>;
}

export interface AnswerActionOptions {
  /** Where the server takes action calls: `createServer({ action: { path } })`. `/_action` unless it was moved. */
  path?: string;
}

/** What the action answers: its output, or a function of the input the page sent. */
export type ActionAnswer = Record<string, unknown> | ((input: Record<string, unknown>) => Record<string, unknown>);

const callOf = (request: AnsweredRequest): { actionId: string; input: Record<string, unknown> } | undefined => {
  if (request.method() !== 'POST') {
    return undefined;
  }

  try {
    const body: unknown = JSON.parse(request.postData() ?? '');
    if (typeof body !== 'object' || body === null || !('actionId' in body) || typeof body.actionId !== 'string') {
      return undefined;
    }

    const input = 'input' in body && typeof body.input === 'object' && body.input !== null ? body.input : {};

    return { actionId: body.actionId, input: input as Record<string, unknown> };
  } catch {
    return undefined;
  }
};

/**
 * Answers one server action in the browser, so a test never runs it: the page's `runServerAction` gets `output` as if
 * the server had completed the run, and the server — its `kv`, its files, what the developer saved — is not touched.
 *
 * For the test that would otherwise write the state it reads: one that opens windows changes the wall the developer
 * kept, and a wall somebody kept covers the controls the next test clicks. Every other call goes through.
 *
 * ```ts
 * await answerAction(page, 'world-workspace', { windows: [] });
 * await answerAction(page, 'search', input => ({ results: fixtureFor(input.query) }));
 * await openPage(page, '/');
 * ```
 *
 * Answers a `stream` step too, with the one `done` frame a run that streamed nothing ends with.
 */
export const answerAction = async (
  page: RoutingPage,
  actionId: string,
  answer: ActionAnswer,
  { path = '/_action' }: AnswerActionOptions = {}
): Promise<void> => {
  await page.route(`**${path}`, async route => {
    const request = route.request();
    const call = callOf(request);
    if (call?.actionId !== actionId) {
      await route.fallback();

      return;
    }

    const result = {
      runId: `test-${actionId}`,
      status: 'completed',
      output: typeof answer === 'function' ? answer(call.input) : answer
    };
    const { accept = '' } = request.headers();
    await route.fulfill(
      accept.includes('text/event-stream')
        ? { contentType: 'text/event-stream', body: `event: done\ndata: ${JSON.stringify(result)}\n\n` }
        : { contentType: 'application/json', body: JSON.stringify(result) }
    );
  });
};
