/** A line to copy: what it is for, the words, and whether it is a command for a terminal or words for the agent. */
export type AgentLine = { id: string; label: string; text: string; kind: 'command' | 'prompt'; note?: string };

/** One way of working with an agent: what is set up once, and what to tell it as the work goes. */
export type AgentWay = { setup: AgentLine[]; prompts: AgentLine[] };

/** The space the lines are written for, and where this deployment's MCP server answers — none where it runs none. */
export type AgentSpace = { name: string; permanentUrl: string; mcpServer?: string };

/** What the MCP server is called in every agent it is added to: the name its tools are listed under. */
const SERVER = 'plitzi';

/**
 * The agents the panel writes for: how each adds an MCP server over HTTP, how — and where — it signs in to it, the
 * command that starts it, and whether it reads the project's `AGENTS.md` by itself — Gemini CLI reads its own
 * `GEMINI.md`, so it is told.
 */
export const AGENTS = [
  {
    id: 'claude',
    label: 'Claude Code',
    start: 'claude',
    readsAgents: true,
    add: (url: string) => `claude mcp add --transport http --scope user ${SERVER} ${url}`,
    login: '/mcp',
    loginWhere: `In a new Claude Code session — one already open does not see Plitzi — type /mcp, pick ${SERVER} and Authenticate.`
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    start: 'opencode',
    readsAgents: true,
    add: (url: string) => `opencode mcp add ${SERVER} --url ${url}`,
    login: `opencode mcp auth ${SERVER}`,
    loginWhere: 'In a terminal.'
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    start: 'gemini',
    readsAgents: false,
    add: (url: string) => `gemini mcp add --scope user --transport http ${SERVER} ${url}`,
    login: `/mcp auth ${SERVER}`,
    loginWhere: 'Inside gemini, started after the line above.'
  },
  {
    id: 'codex',
    label: 'Codex',
    start: 'codex',
    readsAgents: true,
    add: (url: string) => `codex mcp add ${SERVER} --url ${url}`,
    login: `codex mcp login ${SERVER}`,
    loginWhere: 'In a terminal.'
  }
] as const;

export type AgentId = (typeof AGENTS)[number]['id'];

export const isAgentId = (value: unknown): value is AgentId => AGENTS.some(agent => agent.id === value);

/**
 * Working on a space with an agent, the two ways this builder offers — one list, read by the panel and held by its test:
 *
 * - **As a collaborator**: the agent joins the space itself over Plitzi's MCP server, signed in as the person, and
 *   every change it makes is the draft here, made as it makes it — it shows among the collaborators.
 * - **On the computer**: the space taken out as a project with the CLI (`plitzi create --from`), run there, and kept in
 *   step with the space in the cloud — its changes brought in (`space pull`), the project's sent back as the draft
 *   (`space push`). The project carries `AGENTS.md` and Plitzi's skills for whichever agent works in it.
 *
 * Not both at once on one space: a change made here or over the MCP while the project is out makes its push wait for a
 * pull.
 */
export const agentSteps = (
  { name, permanentUrl, mcpServer }: AgentSpace,
  agentId: AgentId
): { collaborator?: AgentWay; local: AgentWay } => {
  const agent = AGENTS.find(each => each.id === agentId) ?? AGENTS[0];
  const folder = permanentUrl;
  // Every choice `create` would ask, said: with nobody at the terminal it asks none and refuses.
  const create = `plitzi create ${folder} --from ${permanentUrl} --package-manager npm --mode server --source local`;
  const guide = agent.id === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';

  return {
    collaborator: mcpServer
      ? {
          setup: [
            {
              id: 'add',
              label: `Add Plitzi to ${agent.label}`,
              text: agent.add(mcpServer),
              kind: 'command',
              note: 'Once, for every folder.'
            },
            {
              id: 'login',
              label: `Sign in, and choose ${name}`,
              text: agent.login,
              kind: 'command',
              note:
                `${agent.loginWhere} Plitzi opens in your browser: sign in, and on the screen that asks which space ` +
                `it may work on, choose ${name} — the agent sees that space alone, and none of it until it is chosen. ` +
                `For another space later, sign out of ${SERVER} in ${agent.label} and sign in again, choosing it.`
            },
            ...(agent.id === 'claude'
              ? [
                  {
                    id: 'claude-app',
                    label: 'Or in the Claude app',
                    text: mcpServer,
                    kind: 'command' as const,
                    note: `Settings → Connectors → Add custom connector, with this address. Connecting asks you to sign in to Plitzi and choose a space: choose ${name}.`
                  }
                ]
              : [])
          ],
          prompts: [
            {
              id: 'join',
              label: 'To start',
              kind: 'prompt',
              text:
                `Open my Plitzi space "${name}" with the ${SERVER} tools and tell me what its pages are. I am in its ` +
                'builder, and I see each change you make as you make it. If you cannot see it, say so and do not pick ' +
                'another: I sign in again and choose it.'
            },
            {
              id: 'change',
              label: 'A change',
              kind: 'prompt',
              text:
                `On the home page, <what you want>. Make it with the ${SERVER} tools, check the page for issues ` +
                'afterwards, and tell me what you changed.'
            }
          ]
        }
      : undefined,
    local: {
      setup: [
        {
          id: 'cli',
          label: 'Install the CLI and sign in',
          text: 'npm install -g @plitzi/cli && plitzi login',
          kind: 'command',
          note: 'Once. It signs in in your browser, and never asks for a password.'
        },
        {
          id: 'project',
          label: 'Bring this space to your computer, running',
          text: `${create} && cd ${folder} && plitzi space use && npm run start:dev`,
          kind: 'command',
          note: `plitzi space use asks in the browser which space the CLI works with: choose ${name}, so what is sent lands here.`
        },
        {
          id: 'start',
          label: `Start ${agent.label} in that folder`,
          text: agent.start,
          kind: 'command',
          note: agent.readsAgents
            ? `It reads the project’s ${guide} — how a space is written, and Plitzi’s skills — by itself.`
            : 'Tell it first to read AGENTS.md: it reads its own GEMINI.md, which the project does not have.'
        }
      ],
      prompts: [
        {
          id: 'all',
          label: 'Or all of it, from an empty folder',
          kind: 'prompt',
          text:
            `Use the Plitzi CLI to work on my Plitzi space "${name}" on this computer: install it if it is missing ` +
            '(npm install -g @plitzi/cli), sign me in with plitzi login, bring the space here with ' +
            `${create}, connect the CLI to it with plitzi space use (I choose ${name} in the browser), start it with ` +
            `npm run start:dev in ${folder}/ and tell me the address it serves. Then read ${folder}/${guide}.`
        },
        {
          id: 'pull',
          label: 'Bring in what changed in the cloud',
          kind: 'prompt',
          text:
            'Bring in what changed on Plitzi with plitzi space pull, and tell me what came in. If a file changed on ' +
            'both sides, show me the two and ask me before choosing.'
        },
        {
          id: 'change',
          label: 'Make a change, checked',
          kind: 'prompt',
          text:
            'On the home page, <what you want>. Write it in src/space as the skills say, check it with plitzi space ' +
            'lint, and show me a screenshot of the page with plitzi page shot /.'
        },
        {
          id: 'push',
          label: 'Send it to the cloud, as the draft',
          kind: 'prompt',
          text:
            'Check the project with plitzi space lint, then put it on Plitzi as the space’s draft with plitzi space ' +
            'push, and tell me what went up. If it is refused because the draft changed in the builder, pull first — ' +
            'never --force unless I say so.'
        }
      ]
    }
  };
};
