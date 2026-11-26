/**
 * What the page's dev tools know, read from the page in text: the flows that ran — the failed ones above all — the
 * state, the sources and one element. The dev tools publish it on `window.__plitzi` while they are on (debug mode,
 * any development server); a page without them answers nothing, and says so.
 */

/** One step of a flow that ran, as the dev tools tell it. */
export interface DevToolsFlowStep {
  title: string;
  action: string;
  status: string;
  ms: number;
  error?: string;
}

/** A flow that ran: what fired it, on what, how it ended, and its steps. */
export interface DevToolsFlow {
  at: string;
  trigger: string;
  on?: string;
  status: string;
  ms: number;
  steps: DevToolsFlowStep[];
}

/** A flow still on its way when the page was read: what fired it, on what, and for how long so far. */
export interface DevToolsRunningFlow {
  trigger: string;
  on?: string;
  ms: number;
}

export interface DevToolsReport {
  /** Whether the page had its dev tools on — without them there is nothing to read. */
  available: boolean;
  flows: DevToolsFlow[];
  /**
   * The flows still running as it was read — a page-load flow waiting out a delay: what it holds may change yet, and a
   * reading of the state taken now is told from one taken once every flow has ended.
   */
  running: DevToolsRunningFlow[];
  state?: unknown;
  /** Every source by its full name, with the shape of what it holds now. */
  sources?: Record<string, unknown>;
  element?: unknown;
  /**
   * Why each server element failed on the page server since the page loaded, by id — though the browser asked again
   * and was answered: what the first paint and a crawler lacked (`window.__plitzi.serverFailures()`).
   */
  serverFailures: Record<string, string>;
}

export interface DevToolsInput {
  state: boolean;
  element?: string;
}

/** Anything that can run a function in a browser page — Playwright's `Page`, Puppeteer's. */
export interface DevToolsDriver {
  evaluate<R, A>(fn: (input: A) => R | Promise<R>, input: A): Promise<R>;
}

/** Runs in the page. Self-contained — it is serialised — and it trusts nothing it reads off `window`. */
export const readDevToolsInPage = ({ state, element }: DevToolsInput): DevToolsReport => {
  const inspector: unknown = Reflect.get(window, '__plitzi');
  const call = (name: string, ...args: unknown[]): unknown => {
    const method: unknown =
      typeof inspector === 'object' && inspector !== null ? Reflect.get(inspector, name) : undefined;

    return typeof method === 'function' ? Reflect.apply(method, inspector, args) : undefined;
  };
  if (typeof inspector !== 'object' || inspector === null) {
    return { available: false, flows: [], running: [], serverFailures: {} };
  }

  // Inside the serialised function: nothing outside it reaches the page.
  const isFlow = (value: unknown): value is DevToolsFlow =>
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'trigger') === 'string' &&
    typeof Reflect.get(value, 'status') === 'string' &&
    Array.isArray(Reflect.get(value, 'steps'));
  const isRunning = (value: unknown): value is DevToolsRunningFlow =>
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'trigger') === 'string' &&
    typeof Reflect.get(value, 'ms') === 'number';
  const flows = call('flows', 50);
  const running = call('running');
  const sources = state ? call('sources') : undefined;
  const failures = call('serverFailures');

  return {
    available: true,
    flows: Array.isArray(flows) ? flows.filter(isFlow) : [],
    running: Array.isArray(running) ? running.filter(isRunning) : [],
    serverFailures:
      typeof failures === 'object' && failures !== null
        ? Object.fromEntries(
            Object.entries(failures).flatMap(([id, why]) => (typeof why === 'string' ? [[id, why] as const] : []))
          )
        : {},
    ...(state ? { state: call('state') } : {}),
    ...(state && typeof sources === 'object' && sources !== null
      ? { sources: Object.fromEntries(Object.keys(sources).map(name => [name, Reflect.get(sources, name)])) }
      : {}),
    ...(element ? { element: call('element', element) ?? null } : {})
  };
};

/** The page's dev tools, read: the flows that ran and, when asked, the state, the sources and one element. */
export const readDevTools = (driver: DevToolsDriver, input: DevToolsInput): Promise<DevToolsReport> =>
  driver.evaluate(readDevToolsInPage, input);

/** A failed flow in one line, with the steps that failed under it. */
export const failedFlowText = (flow: DevToolsFlow): string =>
  `flow ${flow.trigger}${flow.on ? ` on ${flow.on}` : ''} failed` +
  flow.steps
    .filter(step => step.status === 'failed')
    .map(step => ` — ${step.title} [${step.action}]${step.error ? `: ${step.error}` : ''}`)
    .join('');
