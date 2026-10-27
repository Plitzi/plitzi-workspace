import type { Canvas } from './monitorCanvas';
import type { PreviewState } from './monitorPreview';
import type { SpendSort } from './monitorSpend';
import type { Theme } from './monitorTheme';
import type { AgentLine, AgentStatus } from '../../../runs/view/monitor';
import type { TaskLine } from '../../../runs/view/view';

/**
 * What the monitor's screen is drawn from beyond the run: where the person is in it — the view, the task selected,
 * what is opened — and the words every part of it says a state with, each a glyph and a tone of the theme.
 */

export type MonitorView = 'overview' | 'flow' | 'tasks' | 'agents' | 'spend';

/**
 * How much the panel says: `simple` only what a person acts on — who is at what, how far the run is, what needs them,
 * the preview, the latest — and `advanced` everything: the views, the whole activity, the spend (`m` switches).
 */
export type MonitorMode = 'simple' | 'advanced';

/** The views, as their tabs name them: the number on each is its key. */
export const VIEWS: readonly { view: MonitorView; label: string }[] = [
  { view: 'overview', label: 'Overview' },
  { view: 'flow', label: 'Flow' },
  { view: 'tasks', label: 'Tasks' },
  { view: 'agents', label: 'Agents' },
  { view: 'spend', label: 'Spend' }
];

export type Dialog =
  | { kind: 'task' }
  | { kind: 'help' }
  /** Every notice, whole: what the box shows one of. */
  | { kind: 'needs' }
  | { kind: 'palette'; query: string; at: number };

export interface MonitorUi {
  mode: MonitorMode;
  view: MonitorView;
  /** The task selected, in the list the view shows. */
  selected: number;
  /** The approved tasks listed one by one too (`a`); otherwise said in a line. */
  showApproved: boolean;
  /** How many events back from the newest the activity is scrolled (← older, → newer). */
  feedBack: number;
  /** The events opened: a group of repeats, or one with more to say (`groupKey`). */
  opened: ReadonlySet<string>;
  /** How far down each stage of the flow its cards are scrolled, by its key. */
  flowOffsets: ReadonlyMap<string, number>;
  spendSort: SpendSort;
  /** Which notice the box shows, of those not put off. */
  needsAt: number;
  /** The notices put off for later (`esc`), by `needKey`: back once they say something else. */
  dismissed: ReadonlySet<string>;
  dialog?: Dialog;
  /** The animation's frame: the spinner of an agent at work, its verb's shimmer. */
  frame: number;
  /** A word said for a moment in the status bar: what a key just did. */
  flash?: string;
}

export const initialUi = (mode: MonitorMode): MonitorUi => ({
  mode,
  view: 'overview',
  selected: 0,
  showApproved: false,
  feedBack: 0,
  opened: new Set(),
  flowOffsets: new Map(),
  spendSort: 'spent',
  needsAt: 0,
  dismissed: new Set(),
  frame: 0
});

/** What a click on the screen does where it lands. */
export type HitAction =
  { kind: 'view'; view: MonitorView } | { kind: 'task'; index: number } | { kind: 'event'; key: string };

export interface Hit {
  row: number;
  from: number;
  to: number;
  action: HitAction;
}

/** What the wheel scrolls where it is over. */
export type AreaKind = { kind: 'activity' } | { kind: 'tasks' } | { kind: 'stage'; key: string };

export interface Area {
  area: AreaKind;
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The preview as the panel shows it: where it stands, and what its server said last. */
export interface PreviewShown {
  state: PreviewState;
  output: string[];
}

/** What every part of the screen draws with: the canvas, the theme, each agent's hue, and where clicks and wheels go. */
export interface Paint {
  canvas: Canvas;
  theme: Theme;
  hues: ReadonlyMap<string, string>;
  now: Date;
  hits: Hit[];
  areas: Area[];
}

/** A tone of the theme, by name: what a state is drawn in, in either theme. */
export type Tone = 'text' | 'muted' | 'subtle' | 'primary' | 'link' | 'success' | 'warning' | 'danger' | 'info';

export const toneOf = (theme: Theme, tone: Tone): string => theme[tone];

/** Where a task stands, as a glyph, a word and a tone: the same in the strip, the lists, the flow and its dialog. */
export const TASK_LOOK: Record<TaskLine['status'], { glyph: string; label: string; tone: Tone }> = {
  'in-progress': { glyph: '◐', label: 'at work', tone: 'info' },
  'changes-requested': { glyph: '↺', label: 'sent back', tone: 'warning' },
  'in-review': { glyph: '◎', label: 'in review', tone: 'link' },
  waiting: { glyph: '…', label: 'waiting', tone: 'warning' },
  blocked: { glyph: '■', label: 'blocked', tone: 'danger' },
  failed: { glyph: '✗', label: 'failed', tone: 'danger' },
  ready: { glyph: '○', label: 'ready', tone: 'muted' },
  pending: { glyph: '○', label: 'pending', tone: 'subtle' },
  done: { glyph: '✓', label: 'approved', tone: 'success' }
};

/** Where an agent stands, as a glyph, a word and a tone — the word drawn in its tone wherever an agent is listed. */
/**
 * How an agent comes to the run, as the monitor marks it beside its name: the base starts with the run and keeps
 * running, one on demand only while work waits for it — told apart at a glance (Carlos read no difference in a muted
 * column).
 */
export const startsLook = (
  agent: Pick<AgentLine, 'kind' | 'onDemand'>
): { glyph: string; label: string; tone: Tone } =>
  agent.kind === 'lead'
    ? { glyph: '★', label: 'lead', tone: 'primary' }
    : agent.onDemand === true
      ? { glyph: '◇', label: 'on demand', tone: 'info' }
      : { glyph: '◆', label: 'base', tone: 'success' };

export const AGENT_LOOK: Record<AgentStatus, { glyph: string; label: string; tone: Tone }> = {
  working: { glyph: '●', label: 'working', tone: 'primary' },
  reviewing: { glyph: '●', label: 'reviewing', tone: 'link' },
  away: { glyph: '◐', label: 'away', tone: 'warning' },
  blocked: { glyph: '●', label: 'blocked', tone: 'warning' },
  asking: { glyph: '?', label: 'asks the lead', tone: 'warning' },
  waiting: { glyph: '◌', label: 'waiting', tone: 'info' },
  idle: { glyph: '○', label: 'idle', tone: 'subtle' },
  stopped: { glyph: '◼', label: 'stopped', tone: 'subtle' },
  restarting: { glyph: '↻', label: 'restarting', tone: 'info' },
  done: { glyph: '✓', label: 'done', tone: 'success' },
  'not-started': { glyph: '·', label: 'not started', tone: 'subtle' },
  'no-signal': { glyph: '●', label: 'no signal', tone: 'danger' }
};

/** The verb an agent at work is said by: a scout finds out, every other writes. */
export const liveVerb = (agent: Pick<AgentLine, 'status' | 'roles' | 'task'>): string =>
  agent.task === undefined && agent.status === 'working'
    ? 'Working'
    : agent.status === 'working' && agent.roles.includes('scout')
      ? 'Finding out'
      : (LIVE_VERB[agent.status] ?? '');

/** An agent's state as the live line says it: the verb at its head, shimmering while it is so. */
export const LIVE_VERB: Partial<Record<AgentStatus, string>> = {
  working: 'Writing',
  reviewing: 'Reviewing',
  asking: 'Asking',
  restarting: 'Restarting',
  waiting: 'Waiting'
};

/** A task's urgency mark: `‼` critical, `!` high — none once approved. */
export const urgencyOf = (task: Pick<TaskLine, 'urgency' | 'status'>): '‼' | '!' | '' =>
  task.status === 'done' ? '' : task.urgency === 'critical' ? '‼' : task.urgency === 'high' ? '!' : '';

/** Minutes in a few characters: 4m, 1h 12m. */
export const minutesText = (minutes: number): string =>
  minutes < 60 ? `${String(minutes)}m` : `${String(Math.floor(minutes / 60))}h ${String(minutes % 60)}m`;

/** How long since `iso`, in the panel's few characters: now, 4m, 1h 12m. */
export const since = (iso: string | undefined, now: Date): string => {
  if (iso === undefined) {
    return '';
  }

  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));

  return minutes < 1 ? 'now' : minutesText(minutes);
};

export const hhmm = (iso: string): string => iso.slice(11, 16);
