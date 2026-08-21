import { authorFlow } from '@plitzi/sdk-schema';

import type { ActionLookups } from '@plitzi/sdk-server/actions';
import type { ActionEntry } from '@plitzi/sdk-shared';

/**
 * The three things this blog does on the server, as documents.
 *
 * An action is not code: it is the same node map an element's interactions are, and `authorFlow` chains it — so
 * the flows the builder would draw and the flows written here are the same objects. Each of these is a way in, a
 * step, and the output that decides what leaves the server.
 *
 * The two READS are `render` triggers: nobody calls them, they run while the page is being built, and the page
 * they feed names them on an element. The WRITE is a `call` trigger, and the only one a browser can reach.
 */

/**
 * The output step is the contract, and here it names one token.
 *
 * `{{ posts }}` is the whole result of the step called `posts`, so what the task returned is what the caller gets
 * — nothing restated, nothing to keep in step. A field the page must never see is one the TASK does not return.
 */
const listPosts: ActionEntry = {
  id: 'list-posts',
  document: {
    name: 'Latest posts',
    description: 'The home page list, resolved while the page renders.',
    nodes: authorFlow('list-posts', [
      {
        id: 'start',
        type: 'trigger',
        action: 'render',
        params: {
          // A blog is public, and saying so is a decision rather than a default: a trigger with no access rule is
          // refused, because an unstated one is either a lock-out or a hole.
          access: 'public',
          input: JSON.stringify({ page: { type: 'number', defaultValue: 1, label: 'Page' } })
        }
      },
      // `page` arrives from the query string the pager writes — a render's input is the page's own route and query
      // params, so a pager and a detail page need nothing wired between them.
      { id: 'posts', type: 'task', action: 'blog.listPosts', params: { page: '{{input.page}}' } },
      { id: 'answer', type: 'task', action: 'flow.output', params: { values: '{{ posts }}' } }
    ])
  }
};

const getPost: ActionEntry = {
  id: 'get-post',
  document: {
    name: 'One post',
    description: 'The detail page, by the slug in its route.',
    nodes: authorFlow('get-post', [
      {
        id: 'start',
        type: 'trigger',
        action: 'render',
        params: {
          access: 'public',
          input: JSON.stringify({ slug: { type: 'text', required: true, label: 'Slug' } })
        }
      },
      { id: 'post', type: 'task', action: 'blog.getPost', params: { slug: '{{input.slug}}' } },
      { id: 'answer', type: 'task', action: 'flow.output', params: { values: '{{ post }}' } }
    ])
  }
};

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
            body: { type: 'text', required: true, label: 'Body' }
          })
        }
      },
      { id: 'published', type: 'task', action: 'blog.publishPost', params: { title: '{{input.title}}', body: '{{input.body}}' } },
      { id: 'answer', type: 'task', action: 'flow.output', params: { values: '{{ published }}' } }
    ])
  }
};

const actions = [listPosts, getPost, publishPost];

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
