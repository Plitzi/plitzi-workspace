import { authorFlow } from '@plitzi/sdk-schema';

import type { StepSpec } from '@plitzi/sdk-schema';
import type { ActionLookups } from '@plitzi/sdk-server/actions';
import type { ActionEntry } from '@plitzi/sdk-shared';

/**
 * The four things this blog does on the server, as documents.
 *
 * An action is not code: it is the same node map an element's interactions are, and `authorFlow` chains it — so
 * the flows the builder would draw and the flows written here are the same objects. Each of these is a way in, a
 * step, and the output that decides what leaves the server.
 *
 * The three READS are `render` triggers: nobody calls them, they run while the page is being built, and the page
 * they feed names them on an element. The WRITE is a `call` trigger, and the only one a browser can reach.
 */

/**
 * A read, in the shape all three of them take.
 *
 * The output step is the contract, and here it names one token: `{{ result }}` is the whole of what the task
 * returned, so what the page receives is what the task chose to hand back. A field the page must never see is a
 * field the task does not return — there is no second contract to keep in step with the first.
 */
const read = (
  id: string,
  name: string,
  task: string,
  input: Record<string, unknown>,
  params: Record<string, unknown> = {}
): ActionEntry => ({
  id,
  document: {
    name,
    nodes: authorFlow(id, [
      {
        id: 'start',
        type: 'trigger',
        action: 'render',
        params: {
          // A blog is public, and saying so is a decision rather than a default: a trigger with no access rule is
          // refused, because an unstated one is either a lock-out or a hole.
          access: 'public',
          input: JSON.stringify(input)
        }
      },
      { id: 'result', type: 'task', action: task, params },
      { id: 'answer', type: 'task', action: 'flow.output', params: { values: '{{ result }}' } }
    ])
  }
});

/**
 * The home page's list.
 *
 * `page` arrives from the query string the pager writes, and `perPage` / `featured` from the element itself — a
 * render trigger's input is the page's own route and query params plus whatever the element declares, so the
 * sidebar and the main column can read one action with two different questions.
 */
const listPosts = read(
  'list-posts',
  'Posts',
  'blog.listPosts',
  {
    page: { type: 'number', defaultValue: 1, label: 'Page' },
    perPage: { type: 'number', defaultValue: 4, label: 'Per page' },
    featured: { type: 'boolean', defaultValue: false, label: 'Lead with the newest' }
  },
  { page: '{{input.page}}', perPage: '{{input.perPage}}', featured: '{{input.featured}}' }
);

/** The detail page. `{{input.slug}}` is the route parameter, with nothing wired between the URL and the flow. */
const getPost = read(
  'get-post',
  'One post',
  'blog.getPost',
  { slug: { type: 'text', required: true, label: 'Slug' } },
  { slug: '{{input.slug}}' }
);

/** The header. Takes nothing: everything it answers comes from the session the request carried. */
const siteChrome = read('site-chrome', 'Site header', 'blog.chrome', {});

/**
 * The one a browser can start, and the only place in this example where permissions are decided.
 *
 * `access: 'role'` is checked before a single step runs and before the run costs anything — so `grace`, who is
 * signed in and has no `postPublish`, is refused by the server rather than by a page that hid the button.
 */
const publishPost: ActionEntry = {
  id: 'publish-post',
  document: {
    name: 'Publish a post',
    description: 'Adds a post, credited to the session that sent it.',
    nodes: authorFlow('publish-post', [
      {
        id: 'start',
        type: 'trigger',
        action: 'call',
        params: {
          access: 'role',
          permissions: 'postPublish',
          // Undeclared keys are dropped before anything runs, which is what makes interpolating `{{input.*}}`
          // into a later step safe — and why no caller can smuggle in an author.
          input: JSON.stringify({
            title: { type: 'text', required: true, label: 'Title' },
            standfirst: { type: 'text', label: 'Standfirst' },
            body: { type: 'text', required: true, label: 'Body' },
            topic: { type: 'text', label: 'Topic' }
          })
        }
      },
      {
        id: 'published',
        type: 'task',
        action: 'blog.publishPost',
        params: {
          title: '{{input.title}}',
          standfirst: '{{input.standfirst}}',
          body: '{{input.body}}',
          topic: '{{input.topic}}'
        }
      },
      { id: 'answer', type: 'task', action: 'flow.output', params: { values: '{{ published }}' } }
    ] satisfies StepSpec[])
  }
};

const actions = [listPosts, getPost, siteChrome, publishPost];

/**
 * How the server reaches an action.
 *
 * A real deployment reads a row and takes `at` — the revision the calling page was published at — into account,
 * so a published site keeps running the flow it shipped with. This one serves a single live version and says so
 * by ignoring the argument; the sibling example [05-with-server-actions/01-actions] is where that rule is shown.
 */
export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions)
};
