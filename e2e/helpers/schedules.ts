import type { APIRequestContext } from '@playwright/test';

/**
 * The schedules example (`examples/05-with-server-actions/05-schedules`) as a spec reads it: its board, and the actions
 * its page presses. One replica or two, the questions are the same, so both specs ask them through here.
 */

export type BoardJob = { id: string; name: string; status: string; detail: string; error: string; history: string };
export type BoardActivity = { replica: string; message: string };
export type Board = {
  servedBy: string;
  schedules: { name: string; next: string; enabled: boolean }[];
  jobs: BoardJob[];
  activity: BoardActivity[];
};

/** The board as the page receives it: the `queue-board` render action's slice, the one element on the page. */
export const scheduleBoard = async (request: APIRequestContext, origin: string): Promise<Board> => {
  const response = await request.get(`${origin}/_rsc?location=%2F`);
  const { serverData } = (await response.json()) as { serverData: Record<string, Board> };
  const [slice] = Object.values(serverData);

  return slice;
};

export const callAction = async (
  request: APIRequestContext,
  origin: string,
  actionId: string,
  input: Record<string, unknown>
) => {
  const response = await request.post(`${origin}/_action`, { data: { actionId, input } });

  return { status: response.status(), body: (await response.json()) as { output: { jobId: string } } };
};

export const boardJob = async (
  request: APIRequestContext,
  origin: string,
  jobId: string
): Promise<BoardJob | undefined> => (await scheduleBoard(request, origin)).jobs.find(entry => entry.id === jobId);
