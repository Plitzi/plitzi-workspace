import { isResearch } from './spike';
import { DESIGNER, DEVELOPER, SCOUT, startedAgents } from './team';
import { reviewedAsUi } from './uiFiles';

import type { RunPlan } from './model';
import type { Team } from './team';

/** What `run open --dry-run` says of the team beside the work: too big for it, or too few designers for the UI it changes. */

/** The developers a designer keeps up with: past it, UI reviews queue, and their reviewer looks at them itself or they wait. */
export const DEVELOPERS_PER_DESIGNER = 3;

/**
 * …and in a copy of a site (`reference`), where each review measures every value against it: one each. A run's
 * two developers built four tasks in 22 minutes, and its one designer's reviews — 6 to 16 minutes each — held the run
 * another hour.
 */
export const DEVELOPERS_PER_DESIGNER_COPYING = 1;

/** Below it, a team's agents spend more on starting than on the work: each reads the skills and its brief first. */
export const TASKS_PER_AGENT = 2;

/**
 * Too many agents for the work, said before the run starts: a run's three tasks of a few values each went to
 * two developers and a designer — dev-2 spent 62k tokens, most of them its start, on one task of two lines.
 */
const teamSizeNotice = (
  plan: Pick<RunPlan, 'tasks'>,
  team: Team,
  openWork: number,
  backlog: readonly string[]
): string[] => {
  // A stage's tasks beside the run's still open: a run's stack of one was told "1 task for 3 agents".
  // Research is the scouts' and the work the rest's: counted together, encore-14's two research cards read "2 tasks for
  // 5 agents", a team too big, where its one scout was too few (`researchNotice`).
  const work = plan.tasks.filter(task => task.role !== 'lead' && !isResearch(task)).length + openWork;
  const agents = startedAgents(team).filter(each => !each.roles.includes(SCOUT)).length;
  if (work === 0 || work >= agents * TASKS_PER_AGENT) {
    return [];
  }

  return [
    // A kanban keeps a card ready beside each one in review: a run's three cards for two agents left each waiting
    // its own verdicts with nothing to take.
    `${String(work)} task${work === 1 ? '' : 's'} for ${String(agents)} agents: each agent starts by reading the skills and its brief — tens of thousands of tokens and minutes before its first line — so fewer than ${String(TASKS_PER_AGENT)} tasks each pays more for starting than for the work, and an agent whose card is in review has none to take. More cards keep the board ahead of the team${backlog.length > 0 ? ` — the backlog holds ${backlog.slice(0, 5).join(', ')}${backlog.length > 5 ? ` +${String(backlog.length - 5)}` : ''} (a task that does one says "closes")` : ''}, or a large card split by what changes apart; else a smaller team does it for less (plitzi run team set <entry> --count …)`
  ];
};

/**
 * Too few designers for the UI to review, said before the run starts: a run's one designer beside four developers
 * left 21 tasks' UI to the lead — and, with a designer in the team, the cards that change what a visitor sees with no
 * designer in their review (`review`): a card says who reviews it, and nobody adds a designer it did not name.
 */
const designersNotice = (plan: Pick<RunPlan, 'tasks' | 'reference'>, team: Team): string[] => {
  const agents = startedAgents(team);
  const designers = agents.filter(each => each.roles.includes(DESIGNER)).length;
  if (designers === 0) {
    return [];
  }

  const developers = agents.filter(each => !each.roles.includes(DESIGNER) && each.roles.includes(DEVELOPER)).length;
  const looked = plan.tasks.filter(task => task.review?.includes(DESIGNER) === true).length;
  const unlooked = plan.tasks
    .filter(task => task.review?.includes(DESIGNER) !== true && reviewedAsUi(task.role, task.files))
    .map(task => task.id);
  const perDesigner = plan.reference === undefined ? DEVELOPERS_PER_DESIGNER : DEVELOPERS_PER_DESIGNER_COPYING;
  const needed = Math.min(Math.ceil(developers / perDesigner), looked);

  return [
    ...(unlooked.length > 0
      ? [
          `${unlooked.join(', ')} change${unlooked.length === 1 ? 's' : ''} what a visitor sees with no designer in ${unlooked.length === 1 ? 'its' : 'their'} review: "review": ["designer", "tester"] has a designer look first — left as it is, ${unlooked.length === 1 ? 'its' : 'their'} reviewer looks at the UI too`
        ]
      : []),
    ...(looked > 0 && designers < needed
      ? [
          `${String(looked)} tasks a designer reviews, and ${String(designers)} designer${designers === 1 ? '' : 's'} beside ${String(developers)} developers: one for every ${String(perDesigner)}${plan.reference === undefined ? '' : ' in a copy of a site, each review measuring it against the original,'} keeps the reviews from queueing — ${String(needed)} (plitzi run team set <designer entry> --roles designer --count ${String(needed)}). Fewer, and a designer's step nobody takes in time is the next reviewer's too`
        ]
      : [])
  ];
};

/** The team's notices: one too big for the work is not told to grow — the designers it would add have less to review. */
export const teamNotices = (
  plan: Pick<RunPlan, 'tasks' | 'reference'>,
  team: Team,
  openWork = 0,
  /** The backlog's open items no task of the plan closes: the cards that could keep the team busy. */
  backlog: readonly string[] = []
): string[] => {
  const tooBig = teamSizeNotice(plan, team, openWork, backlog);

  return [...(tooBig.length > 0 ? tooBig : designersNotice(plan, team)), ...researchNotice(plan, team)];
};

/**
 * More research cards ready at once than scouts to find them out: they go one after another, where dividing them was
 * for their speed — encore-14's two flaky specs waited behind the scope for its one scout. The team's most is the
 * person's: said, never raised.
 */
const researchNotice = (plan: Pick<RunPlan, 'tasks'>, team: Team): string[] => {
  const research = plan.tasks.filter(task => isResearch(task) && task.dependsOn.length === 0).map(task => task.id);
  const scouts = startedAgents(team).filter(each => each.roles.includes(SCOUT)).length;
  if (research.length <= Math.max(scouts, 1)) {
    return [];
  }

  return [
    `${String(research.length)} research cards at once (${research.join(', ')}) and ${scouts === 0 ? 'no scout — the lead finds each out' : `${String(scouts)} scout${scouts === 1 ? '' : 's'} at most`}: they are found out one after another. More scouts are the person's to allow — ask them (plitzi run team set scout --roles scout --count ${String(research.length)}, run in their terminal)`
  ];
};
