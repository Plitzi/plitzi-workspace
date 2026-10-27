import { sayer } from './types';
import { checkTeamFile, TEAM_FILE } from '../runs/agents/team';

import type { Check } from './types';

const say = sayer('team');

/**
 * The team of the project's runs (`.plitzi/team.json`), edited by hand: every field it would read wrong or not at all,
 * said before a run refuses it. No file is nothing to say — a project's first run writes one.
 */
export const checkTeam: Check = async ({ root }) =>
  ((await checkTeamFile(root)) ?? []).map(problem =>
    say.error('team-invalid', `${TEAM_FILE}: ${problem}`, {
      file: TEAM_FILE,
      fix: 'edit it as said — plitzi doctor says it again, plitzi run team set changes one agent for you'
    })
  );
