import {
  apiContainer,
  authorSpace,
  button,
  container,
  form,
  formControl,
  heading,
  list,
  named,
  onClick,
  onSubmit,
  paragraph,
  reloadApi,
  runServerAction,
  setState,
  text,
  themeToggle,
  variantFrom
} from '@plitzi/sdk-authoring';

import {
  activityRow,
  columns,
  elements,
  empty,
  fieldInput,
  header,
  headerActions,
  headerText,
  hint,
  jobRow,
  lede,
  missed,
  notice,
  page,
  panel,
  panelTitle,
  primaryButton,
  reminderBanner,
  reminderDetail,
  reminderTitle,
  remindForm,
  replicaTag,
  rowActions,
  rowButton,
  rowError,
  rowMain,
  rowMeta,
  rowName,
  rows,
  scheduleRow,
  secondaryButton,
  servedBy,
  shell,
  stack,
  stat,
  statLabel,
  stats,
  statusPill,
  statValue,
  themeButton,
  title,
  variables
} from './theme.ts';

import type { AuthoredSpace, ElementSpec, SpaceSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * One page: buttons that put work on the queue, and a board that shows the queue doing it.
 *
 * Everything on the board comes from ONE server provider — `board`, fed by the `queue-board` render action — so the
 * page arrives with the queue already in it, and `refreshSeconds` asks the server for that slice again every two
 * seconds while the tab is open. There is no endpoint of its own and no client code: the same action, run again.
 *
 * The buttons never wait for the work. Each one runs an action that QUEUES a job and answers at once; the job then
 * appears on the board, is claimed by a worker when it comes due, and moves from Waiting to Done (or to Gave up)
 * while you watch.
 */

const BOARD = 'board';

/**
 * What every button does after its action answered: say what happened, and ask the board again now rather than at
 * its next tick — so the job is on screen the moment the server has it.
 */
const afterward = (step: string): StepSpec[] => [
  setState({ key: 'notice', type: 'text', value: `{{${step}.output.summary}}` }),
  reloadApi(BOARD)
];

/**
 * `mode: 'await'` so the answer lands in the flow scope under the step's name. `invalidateQueries: 'none'` because
 * that option refreshes the page's BROWSER requests, and the board is not one — the `reloadApi` after it is what
 * refreshes a server provider.
 */
const run = (actionId: string, input: Record<string, unknown>): StepSpec =>
  named('ran', runServerAction({ actionId, input, mode: 'await', invalidateQueries: 'none' }));

const startButton = (label: string, actionId: string, input: Record<string, unknown>): ElementSpec =>
  button({ content: label, class: secondaryButton, flows: [[onClick(), run(actionId, input), ...afterward('ran')]] });

// ── Header and counters ────────────────────────────────────────────────────────────────────────────────────────

const pageHeader = container({
  class: header,
  children: [
    container({
      class: headerText,
      children: [
        heading({ content: 'Scheduler', subType: 'h1', class: title }),
        paragraph({
          content:
            'Jobs on a clock and jobs on a delay, over a queue this server keeps in a SQLite file. Start a second ' +
            'replica on the same file and they share the work.',
          class: lede
        })
      ]
    }),
    container({
      class: headerActions,
      children: [
        text({ content: '', class: servedBy, bind: { content: `${BOARD}.servedBy` } }),
        themeToggle({ subType: 'switch', lightLabel: 'Light', darkLabel: 'Dark', class: themeButton })
      ]
    })
  ]
});

const counter = (label: string, field: string): ElementSpec =>
  container({
    class: stat,
    children: [
      text({ content: '0', class: statValue, bind: { content: `${BOARD}.counts.${field}` } }),
      text({ content: label, class: statLabel })
    ]
  });

const counters = container({
  class: stats,
  children: [
    counter('Waiting', 'waiting'),
    counter('Running', 'running'),
    counter('Done', 'done'),
    counter('Needs you', 'needsYou')
  ]
});

/**
 * Where a delayed job shows it ran: the next reminder counting down, then — the refresh after its worker ran it — the
 * same banner turning green. The tone names a variant of `reminderBanner`, so one element carries all three looks.
 */
const reminderNotice = container({
  class: reminderBanner,
  visible: `${BOARD}.hasReminder`,
  bind: [variantFrom(reminderBanner, `${BOARD}.reminder.tone`)],
  children: [
    text({ content: '', class: reminderTitle, bind: { content: `${BOARD}.reminder.title` } }),
    text({ content: '', class: reminderDetail, bind: { content: `${BOARD}.reminder.detail` } })
  ]
});

// ── Try it ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The delayed job: a form, because the two values are the point — what to say, and how long to wait. */
const remindFormSpec = form({
  id: 'remind-form',
  // Without this the browser submits the form itself and navigates away; the flow is what runs.
  managedByInteractions: true,
  method: 'post',
  class: remindForm,
  flows: [
    [
      named('submitted', onSubmit()),
      run('remind-me', { message: '{{submitted.values.message}}', seconds: '{{submitted.values.seconds}}' }),
      ...afterward('ran')
    ]
  ],
  children: [
    formControl({
      subType: 'text',
      name: 'message',
      label: 'Remind me to',
      defaultValue: 'Stand up and stretch',
      required: true,
      slots: { input: fieldInput }
    }),
    formControl({
      subType: 'number',
      name: 'seconds',
      label: 'In how many seconds',
      defaultValue: '5',
      required: true,
      slots: { input: fieldInput }
    }),
    button({ subType: 'submit', content: 'Queue the reminder', class: primaryButton })
  ]
});

const tryIt = container({
  class: panel,
  children: [
    text({ content: 'Try it', class: panelTitle }),
    remindFormSpec,
    paragraph({
      content:
        'Or start a job that misbehaves. Failed attempts come back after a backoff; a job out of attempts waits ' +
        'for you to run it again.',
      class: hint
    }),
    startButton('Flaky sync — refused twice, then works', 'start-flaky', { failures: 2 }),
    startButton('Doomed sync — refused every time', 'start-flaky', { failures: 99 }),
    startButton('Slow export — 20 seconds of work', 'start-export', { seconds: 20 }),
    /** Where each answer lands. `setState` writes `runtime.state.notice`; nothing here knows an action ran. */
    text({ content: '', class: notice, bind: { content: 'state.notice' } })
  ]
});

// ── Schedules ──────────────────────────────────────────────────────────────────────────────────────────────────

const schedulesPanel = container({
  class: panel,
  children: [
    text({ content: 'Schedules', class: panelTitle }),
    paragraph({
      content: 'Derived from the actions’ schedule triggers when the server starts. Each fire becomes one job.',
      class: hint
    }),
    list({
      id: 'scheduleRows',
      source: 'controlled',
      class: rows,
      bind: { items: `${BOARD}.schedules` },
      children: [
        container({
          subType: 'li',
          class: scheduleRow,
          children: [
            text({ content: '', class: rowName, bind: { content: 'scheduleRows.item.name' } }),
            text({
              content: '',
              class: rowMeta,
              bind: [
                {
                  to: 'content',
                  source: 'scheduleRows.item',
                  transformers: [
                    { action: 'twigTemplate', params: { template: '{{ source.cron }} · {{ source.zone }}' } }
                  ]
                }
              ]
            }),
            text({ content: '', class: rowMeta, bind: { content: 'scheduleRows.item.next' } }),
            text({
              content: '',
              class: missed,
              visible: 'scheduleRows.item.hasMissed',
              bind: { content: 'scheduleRows.item.missed' }
            })
          ]
        })
      ]
    })
  ]
});

// ── Jobs ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A button on one job's row. In a flow, the row being clicked is `list_<list id>.item` — the list publishes one
 * scope per row, so `{{ list_jobRows.item.id }}` is the id of THIS job and not the first one.
 */
const jobButton = (label: string, actionId: string, visible: string): ElementSpec =>
  button({
    content: label,
    class: rowButton,
    visible,
    flows: [[onClick(), run(actionId, { jobId: '{{ list_jobRows.item.id }}' }), ...afterward('ran')]]
  });

const jobsPanel = container({
  class: panel,
  children: [
    text({ content: 'Jobs', class: panelTitle }),
    list({
      id: 'jobRows',
      source: 'controlled',
      class: rows,
      bind: { items: `${BOARD}.jobs` },
      children: [
        container({
          subType: 'li',
          class: jobRow,
          children: [
            /**
             * One pill whose colour follows the job: the status names a VARIANT of `statusPill`, and `variantFrom`
             * switches it as the job moves — keyed by the class, which is the half nobody guesses right.
             */
            text({
              content: '',
              class: statusPill,
              bind: [
                { to: 'content', source: 'jobRows.item.statusLabel' },
                variantFrom(statusPill, 'jobRows.item.status')
              ]
            }),
            container({
              class: rowMain,
              children: [
                text({ content: '', class: rowName, bind: { content: 'jobRows.item.name' } }),
                text({ content: '', class: rowMeta, bind: { content: 'jobRows.item.detail' } }),
                text({
                  content: '',
                  class: rowMeta,
                  bind: [
                    {
                      to: 'content',
                      source: 'jobRows.item',
                      transformers: [
                        { action: 'twigTemplate', params: { template: '{{ source.source }} · {{ source.attempts }}' } }
                      ]
                    }
                  ]
                }),
                text({
                  content: '',
                  class: rowError,
                  visible: 'jobRows.item.hasError',
                  bind: { content: 'jobRows.item.error' }
                }),
                text({
                  content: '',
                  class: rowMeta,
                  visible: 'jobRows.item.hasHistory',
                  bind: { content: 'jobRows.item.history' }
                })
              ]
            }),
            container({
              class: rowActions,
              children: [
                jobButton('Run again', 'job-retry', 'jobRows.item.canRetry'),
                jobButton('Cancel', 'job-cancel', 'jobRows.item.canCancel')
              ]
            })
          ]
        })
      ]
    }),
    text({
      content: 'No jobs yet. Queue one, or wait for the next minute.',
      class: empty,
      visible: `!${BOARD}.hasJobs`
    })
  ]
});

// ── Activity ───────────────────────────────────────────────────────────────────────────────────────────────────

const activityPanel = container({
  class: panel,
  children: [
    text({ content: 'Activity', class: panelTitle }),
    paragraph({
      content: 'What the jobs did, and which replica did it. Every replica writes here, whichever one serves the page.',
      class: hint
    }),
    list({
      id: 'activityRows',
      source: 'controlled',
      class: rows,
      bind: { items: `${BOARD}.activity` },
      children: [
        container({
          subType: 'li',
          class: activityRow,
          children: [
            text({ content: '', class: rowMeta, bind: { content: 'activityRows.item.time' } }),
            text({ content: '', class: replicaTag, bind: { content: 'activityRows.item.replica' } }),
            text({ content: '', bind: { content: 'activityRows.item.message' } })
          ]
        })
      ]
    }),
    text({ content: 'Nothing has run yet.', class: empty, visible: `!${BOARD}.hasActivity` })
  ]
});

// ── The page ───────────────────────────────────────────────────────────────────────────────────────────────────

const board = apiContainer({
  id: BOARD,
  // A tag of its own, so `shell` has something to lay out: a provider left untagged renders its children alone.
  subType: 'div',
  runtime: 'server',
  action: 'queue-board',
  /**
   * The one attribute that makes this a live board: ask the server for this slice again every two seconds. Paused
   * while the tab is hidden, and never stacked on a refresh still in flight.
   */
  refreshSeconds: 2,
  class: shell,
  children: [
    pageHeader,
    reminderNotice,
    counters,
    container({
      class: columns,
      children: [
        container({ class: stack, children: [tryIt, schedulesPanel] }),
        container({ class: stack, children: [jobsPanel, activityPanel] })
      ]
    })
  ]
});

export const schedulerSpace: SpaceSpec = {
  name: 'Scheduler',
  permanentUrl: 'scheduler-example',
  // Server-resolved elements are off unless a space turns them on, and a server provider in a space that did not
  // renders from mock data with nothing reporting why.
  rsc: { enabled: true },
  theme: { default: 'system', schemes: ['light', 'dark'] },
  variables,
  elements,
  pages: [
    {
      name: 'Scheduler',
      slug: '',
      accessLevel: 'public',
      seoTitle: 'Scheduler — a self-hosted job queue',
      seoDescription: 'Scheduled and delayed jobs over a queue this server keeps itself.',
      class: page,
      body: [board]
    }
  ]
};

export const offlineData = (): AuthoredSpace => authorSpace(schedulerSpace);
