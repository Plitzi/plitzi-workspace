/** A line to copy: what it is for, and the words. */
export type ClaudeLine = { id: string; label: string; text: string; note?: string };

/** One way of working with Claude: what is set up once, and what to tell it as the work goes. */
export type ClaudeWay = { setup: ClaudeLine[]; prompts: ClaudeLine[] };

/** The space the lines are written for, and where this deployment's MCP server answers — none where it runs none. */
export type ClaudeSpace = { name: string; permanentUrl: string; mcpServer?: string };

/**
 * Working on a space with Claude, the two ways this builder offers — one list, read by the panel and held by its test:
 *
 * - **As a collaborator**: Claude joins the space itself over Plitzi's MCP server, signed in as the person, and every
 *   change it makes is the draft here, made as it makes it — it shows among the collaborators.
 * - **On the computer**: the space taken out as a project with the CLI (`plitzi create --from`), run there, and kept in
 *   step with the space in the cloud — its changes brought in (`space pull`), the project's sent back as the draft
 *   (`space push`).
 *
 * Not both at once on one space: a change made here or over the MCP while the project is out makes its push wait for a
 * pull.
 */
export const claudeSteps = ({
  name,
  permanentUrl,
  mcpServer
}: ClaudeSpace): { collaborator?: ClaudeWay; local: ClaudeWay } => {
  const folder = permanentUrl;
  // Every choice `create` would ask, said: with nobody at the terminal it asks none and refuses.
  const create = `plitzi create ${folder} --from ${permanentUrl} --package-manager npm --mode server --source local`;

  return {
    collaborator: mcpServer
      ? {
          setup: [
            {
              id: 'claude-code',
              label: 'Once, in Claude Code',
              text: `claude mcp add --transport http --scope user plitzi ${mcpServer}`,
              note: `Then start a new session and type /mcp to sign in: choose ${name} when it asks which space.`
            },
            {
              id: 'claude-app',
              label: 'Or in the Claude app',
              text: mcpServer,
              note: `Settings → Connectors → Add custom connector, with this address; sign in, and choose ${name}.`
            }
          ],
          prompts: [
            {
              id: 'join',
              label: 'To start',
              text:
                `Open my Plitzi space "${name}" with the plitzi tools and tell me what its pages are. I am in its builder, ` +
                'and I see each change you make as you make it.'
            },
            {
              id: 'change',
              label: 'A change',
              text:
                'On the home page, <what you want>. Make it with the plitzi tools, check the page for issues afterwards, ' +
                'and tell me what you changed.'
            }
          ]
        }
      : undefined,
    local: {
      setup: [
        {
          id: 'cli',
          label: 'Once: the CLI, signed in',
          text: 'npm install -g @plitzi/cli && plitzi login',
          note: 'It signs in in your browser, and never asks for a password.'
        },
        {
          id: 'project',
          label: 'This space on your computer, running',
          text: `${create} && cd ${folder} && plitzi space use && npm run start:dev`,
          note: `plitzi space use asks in the browser which space the CLI works with: choose ${name}, so what is sent lands here.`
        },
        {
          id: 'claude',
          label: 'In that folder, Claude Code',
          text: 'claude',
          note: 'It reads the project’s CLAUDE.md and Plitzi’s skills by itself.'
        }
      ],
      prompts: [
        {
          id: 'all',
          label: 'Or all of it, from an empty folder',
          text:
            `Use the Plitzi CLI to work on my Plitzi space "${name}" on this computer: install it if it is missing ` +
            '(npm install -g @plitzi/cli), sign me in with plitzi login, bring the space here with ' +
            `${create}, connect the CLI to it with plitzi space use (I choose ${name} in the browser), start it with ` +
            `npm run start:dev in ${folder}/ and tell me the address it serves. Then read ${folder}/CLAUDE.md.`
        },
        {
          id: 'pull',
          label: 'The changes made in the cloud, brought in',
          text:
            'Bring in what changed on Plitzi with plitzi space pull, and tell me what came in. If a file changed on ' +
            'both sides, show me the two and ask me before choosing.'
        },
        {
          id: 'change',
          label: 'A change, checked',
          text:
            'On the home page, <what you want>. Write it in src/space as the skills say, check it with plitzi space ' +
            'lint, and show me a screenshot of the page with plitzi page shot /.'
        },
        {
          id: 'push',
          label: 'Sent to the cloud, as the draft',
          text:
            'Check the project with plitzi space lint, then put it on Plitzi as the space’s draft with plitzi space ' +
            'push, and tell me what went up. If it is refused because the draft changed in the builder, pull first — ' +
            'never --force unless I say so.'
        }
      ]
    }
  };
};
