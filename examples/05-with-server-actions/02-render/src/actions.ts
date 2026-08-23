import { defineAction } from '@plitzi/sdk-schema';

import type { ActionLookups } from '@plitzi/sdk-server/actions';
import type { ActionEntry } from '@plitzi/sdk-shared';

/**
 * One action, and the whole of it is a document: fetch a public API, hand the page what it may show.
 *
 * Nothing here is code. The steps are the ones `sdk-server` ships — this deployment registers no task of its own,
 * which is the point: an action that reads an HTTP API is authored, not written.
 */

const catGallery: ActionEntry = defineAction({
  id: 'cat-gallery',
  name: 'Cat gallery',
  description: 'Fetches a handful of cat pictures while the page renders.',
  /**
   * The way in: `render`, which is the page itself asking as it is being built.
   *
   * Its input is the page's own context — route params, then query params — so `/?limit=3` arrives as
   * `input.limit` with nothing to wire. Undeclared keys are dropped and `limit` is coerced to a number, which is
   * what makes interpolating it into a URL below safe.
   *
   * `access: 'public'` because the page is: a render trigger is authorized as whoever is being served, and an
   * anonymous visitor is who most of them are.
   */
  trigger: {
    type: 'render',
    access: 'public',
    input: { limit: { type: 'number', defaultValue: 8, label: 'How many cats' } }
  },
  steps: [
    /**
     * The call the browser never makes.
     *
     * It happens inside the render, from the server's own network position — which is why the URL, the headers
     * and (in a real integration) the credential are things the page never learns. TheCatAPI answers
     * unauthenticated; a provider that needs a key gets `credential: '<identifier>'` on this step, and its values
     * exist only while these params render.
     */
    {
      id: 'fetch',
      task: 'http.request',
      params: { url: 'https://api.thecatapi.com/v1/images/search?limit={{input.limit}}', method: 'GET' }
    },
    /**
     * The step that decides an answer is not worth having.
     *
     * `http.request` does not throw on a 4xx — the status is data, and plenty of flows want to read it — so
     * without this a refusal from the provider would sail into the output as `records`, and the page would show
     * an empty grid saying nothing went wrong. Failing here is what makes the run fail, which is what makes the
     * element report itself unresolved and the page say so.
     */
    {
      id: 'guard',
      task: 'flow.fail',
      params: { message: 'The cat API answered {{ fetch.status }}' },
      when: { combinator: 'and', rules: [{ field: 'fetch.ok', operator: '=', value: 'false' }] }
    }
  ],
  /**
   * The contract, and here it has a second job: `records` is the key a provider element reads.
   *
   * An unquoted token keeps its own type, and an array serializes as JSON — so `{{ fetch.data }}` is the list
   * itself rather than its text. `status` and `ok` stay on the server, because nothing here names them.
   */
  output: '{"records": {{ fetch.data }}, "count": {{ fetch.data|length }}}'
});

const actions: ActionEntry[] = [catGallery];

/** One live document, read by identifier. A real deployment reads a row; the shape is the same either way. */
const getAction = (_spaceId: number, actionId: string): Promise<ActionEntry | undefined> =>
  Promise.resolve(actions.find(entry => entry.id === actionId));

export const lookups: ActionLookups = { getAction };
