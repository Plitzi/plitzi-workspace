import { defineAction } from '@plitzi/sdk-schema';

import type { ActionLookups } from '@plitzi/sdk-server/actions';
import type { ActionEntry, ActionField } from '@plitzi/sdk-shared';

/**
 * The seven things this blog does on the server, as documents.
 *
 * An action is not code: it is the same node map an element's interactions are, and `defineAction` chains it — so
 * the flows the builder would draw and the flows written here are the same objects. Each of these is a way in, a
 * step, and the output that decides what leaves the server.
 *
 * Three of them are `render` triggers: nobody calls them, they run while the page is being built, and the page
 * they feed names them on an element. The other four are `call` triggers, the only ones a browser can reach —
 * one write open to everybody, one behind a permission, one behind a permission AND ownership, and one READ that
 * is a call rather than a render because its answer is about the caller.
 *
 * No step below names its params. A step that does not takes the trigger's declared input one field at a time,
 * which is the whole of what these seven do with it — and it means a field added to a contract cannot leave the
 * task that consumes it behind, which is a gap invisible from both ends: the caller's value validates, is dropped,
 * and the task sees nothing.
 */

/**
 * A read, in the shape all three of them take.
 *
 * The output step is the contract, and left out it names one token: the whole of what the task returned. A field
 * the page must never see is a field the task does not return — there is no second contract to keep in step.
 */
const read = (id: string, name: string, task: string, input: Record<string, ActionField> = {}): ActionEntry =>
  defineAction({
    id,
    name,
    // A blog is public, and saying so is a decision rather than a default: a trigger with no access rule is
    // refused, because an unstated one is either a lock-out or a hole.
    trigger: { type: 'render', access: 'public', input },
    steps: [{ id: 'result', task }]
  });

/**
 * The home page's list.
 *
 * `page` arrives from the query string the pager writes, and `perPage` / `featured` from the element itself — a
 * render trigger's input is the page's own route and query params plus whatever the element declares, so the
 * sidebar and the main column can read one action with two different questions.
 */
const listPosts = read('list-posts', 'Posts', 'blog.listPosts', {
  page: { type: 'number', defaultValue: 1, label: 'Page' },
  perPage: { type: 'number', defaultValue: 4, label: 'Per page' },
  featured: { type: 'boolean', defaultValue: false, label: 'Lead with the newest' },
  // Declared here and set by nobody: it arrives from the QUERY STRING, because a render trigger's input is the
  // page's own route and query params. `/?topic=Ocean` is the whole of how a chip filters this list.
  topic: { type: 'text', defaultValue: '', label: 'Topic' }
});

/** The detail page. `{{input.slug}}` is the route parameter, with nothing wired between the URL and the flow. */
const getPost = read('get-post', 'One post', 'blog.getPost', {
  slug: { type: 'text', required: true, label: 'Slug' }
});

/** The header. Takes nothing: everything it answers comes from the session the request carried. */
const siteChrome = read('site-chrome', 'Site header', 'blog.chrome');

/**
 * The one a browser can start, and the only place in this example where permissions are decided.
 *
 * `access: role` is checked before a single step runs and before the run costs anything — so `grace`, who is
 * signed in and has no `postPublish`, is refused by the server rather than by a page that hid the button.
 */
const publishPost = defineAction({
  id: 'publish-post',
  name: 'Publish a post',
  description: 'Adds a post, credited to the session that sent it.',
  trigger: {
    type: 'call',
    access: { mode: 'role', permissions: ['postPublish'] },
    // Undeclared keys are dropped before anything runs, which is what makes interpolating `{{input.*}}` into a
    // later step safe — and why no caller can smuggle in an author.
    input: {
      title: { type: 'text', required: true, label: 'Title' },
      standfirst: { type: 'text', label: 'Standfirst' },
      body: { type: 'text', required: true, label: 'Body' },
      topic: { type: 'text', label: 'Topic' },
      cover: { type: 'text', label: 'Cover image URL' }
    }
  },
  steps: [{ id: 'published', task: 'blog.publishPost' }]
});

/**
 * The second write, and the one that shows what a role CANNOT decide.
 *
 * Its trigger is the same shape as `publish-post` — `access: role` with `postPublish`, checked before a step runs
 * — and that is deliberately not the whole answer. A permission says whether you may edit posts; it cannot say
 * whether you may edit THIS post, because at the moment it is checked there is no post yet. `blog.updatePost`
 * asks the second question with the record in hand.
 *
 * `slug` is in the input contract and the author is not, which is the same rule as publishing: the caller says
 * WHICH post, the session says WHO, and the store refuses any pair that does not match.
 */
const updatePost = defineAction({
  id: 'update-post',
  name: 'Update a post',
  description: 'Rewrites a post, if the session owns it.',
  trigger: {
    type: 'call',
    access: { mode: 'role', permissions: ['postPublish'] },
    input: {
      slug: { type: 'text', required: true, label: 'Slug' },
      title: { type: 'text', label: 'Title' },
      standfirst: { type: 'text', label: 'Standfirst' },
      body: { type: 'text', label: 'Body' },
      topic: { type: 'text', label: 'Topic' },
      cover: { type: 'text', label: 'Cover image URL' }
    }
  },
  steps: [{ id: 'updated', task: 'blog.updatePost' }]
});

/**
 * The write with no lock on it, and the one to run first when you want to SEE this working.
 *
 * `access: 'public'` is a decision stated out loud, not the absence of one — a trigger with no access rule at all
 * is refused, because an unstated rule is either a lock-out or a hole. Anybody may call this: no session, no
 * permission, no account. It is still a server action, so the count is the server's and the browser is told the
 * answer rather than trusted with it.
 *
 * It is also most of what fills the dev-tools **Actions** tab. The three reads that BUILD these pages are
 * `render` triggers — they run on the server while the page is put together, so the browser never started them
 * and there is nothing for a browser-side panel to record. This one the page starts, and every press shows up,
 * beside the `has-seen-sighting` the post page sends as it loads.
 */
const recordSighting = defineAction({
  id: 'record-sighting',
  name: 'Record a sighting',
  description: 'One more reader who has seen this animal. Open to everybody.',
  trigger: { type: 'call', access: 'public', input: { slug: { type: 'text', required: true, label: 'Slug' } } },
  steps: [{ id: 'logged', task: 'blog.recordSighting' }]
});

/**
 * The other half of "once each", and the reason it is a `call` rather than one more field on `get-post`.
 *
 * A `render` answer is SHARED — one run answers everyone asking at that moment, and a published deployment keeps
 * one copy per session for everyone without one — so a field that differs between two signed-out readers would
 * sooner or later be handed to the wrong one. This runs per request and is never cached, which is what makes
 * "have YOU already counted?" a question the server can answer honestly to somebody with no account.
 */
const hasSeenSighting = defineAction({
  id: 'has-seen-sighting',
  name: 'Already counted?',
  description: 'Whether this reader has already logged a sighting for this post.',
  trigger: { type: 'call', access: 'public', input: { slug: { type: 'text', required: true, label: 'Slug' } } },
  steps: [{ id: 'asked', task: 'blog.hasSeenSighting' }]
});

const actions = [listPosts, getPost, siteChrome, publishPost, updatePost, recordSighting, hasSeenSighting];

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
