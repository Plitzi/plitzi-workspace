import {
  addPost,
  findPost,
  listPosts,
  otherPosts,
  recordSighting,
  sightingLabel,
  topics,
  updatePost,
  view
} from './posts';

import type { ActionTask } from '@plitzi/sdk-server/actions';

/**
 * What this blog can do on the server, as four steps its flows chain together.
 *
 * A task is the extension point a deployment owns: registered here, offered in the builder's step catalog, and
 * addressed from a document as `blog.<action>`. Everything Plitzi needed to know about blogging is in this file.
 */

/** A lone twig token keeps its type and an embedded one arrives as text, so a numeric param shows up either way. */
const toNumber = (value: string | number | undefined, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toBoolean = (value: string | boolean | undefined, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  return value === undefined || value === '' ? fallback : value === 'true' || value === '1';
};

export const listPostsTask: ActionTask<{
  page: string | number;
  perPage: string | number;
  featured: string | boolean;
  topic: string;
}> = {
  namespace: 'blog',
  action: 'listPosts',
  title: 'List Posts',
  description: 'The published posts, newest first, one window at a time — narrowed to a topic when asked.',
  params: {
    page: { type: 'text', canBind: true, defaultValue: '1', label: 'Page' },
    perPage: { type: 'text', canBind: true, defaultValue: '4', label: 'Per page' },
    featured: { type: 'text', canBind: true, defaultValue: 'false', label: 'Lead with the newest' },
    topic: { type: 'text', canBind: true, defaultValue: '', label: 'Topic' }
  },
  run: ({ page, perPage, featured, topic }) => {
    const window = listPosts({
      page: toNumber(page, 1),
      perPage: toNumber(perPage, 4),
      featured: toBoolean(featured, false),
      topic: topic ? String(topic) : ''
    });

    // The chips travel with the answer, and they know which one is chosen — so the page renders a state rather
    // than working one out. Nothing on the page compares anything.
    return { ...window, topics: topics(window.topic) };
  }
};

export const getPostTask: ActionTask<{ slug: string }> = {
  namespace: 'blog',
  action: 'getPost',
  title: 'Get Post',
  description: 'One post, by the slug in the URL, with the ones to read next.',
  params: { slug: { type: 'text', canBind: true, defaultValue: '', label: 'Slug' } },
  run: ({ slug }, ctx) => {
    const post = findPost(slug);
    /**
     * Two questions, and they are not the same one.
     *
     * `postPublish` is a permission and belongs to a PERSON; being the author belongs to a ROW. The action's
     * trigger can only ask the first, before any step runs and without a record in hand — so the second is asked
     * here, and the page binds an "Edit" link to the answer. The lock is still `blog.updatePost`, which asks it
     * again with the record it is about to change.
     */
    const canEdit = Boolean(post && ctx.user?.permissions.includes('postPublish') && ctx.user.id === post.authorId);

    /**
     * Both answers, always — and `record` is an object either way.
     *
     * The flow's output step interpolates this whole result into JSON, and a missing value would render as
     * nothing at all: `{"record": }` is not a document, so a URL nobody wrote a post for would fail the run
     * rather than show a page that says so. `found` and `missing` are what the two halves of the page bind their
     * visibility to.
     */
    return {
      record: post ? view(post) : {},
      found: Boolean(post),
      missing: !post,
      canEdit,
      // Its opposite, for the other half of the editor page: a binding shows an element when its field is true.
      cannotEdit: Boolean(post) && !canEdit,
      editUrl: post ? `/edit/${post.slug}` : '',
      more: otherPosts(slug)
    };
  }
};

/**
 * Who is looking, in the two words the page needs.
 *
 * The header is the same on every page and it is not the same for everybody: an editor link nobody may use is a
 * dead end, and "Account" where a name belongs is a site that has not noticed you signed in. Both answers come
 * from the session, on the server — the link is hidden as a courtesy, and the action behind it is what actually
 * refuses anyone without the permission.
 */
export const siteChromeTask: ActionTask<Record<string, never>> = {
  namespace: 'blog',
  action: 'chrome',
  title: 'Site Chrome',
  description: 'What the header shows: who is signed in, and whether they may write.',
  params: {},
  run: (_params, ctx) => {
    const { user } = ctx;
    const canWrite = Boolean(user?.permissions.includes('postPublish'));

    return {
      signedIn: Boolean(user),
      // Its opposite, because a binding shows an element when its field is true and there is no "unless" — and
      // the header has two account controls rather than one that changes: a name to open, or an invitation.
      signedOut: !user,
      canWrite,
      readOnly: Boolean(user) && !canWrite,
      accountLabel: user?.username ?? '',
      initial: user ? user.username.slice(0, 1).toUpperCase() : ''
    };
  }
};

export const publishPostTask: ActionTask<{
  title: string;
  standfirst: string;
  body: string;
  topic: string;
  cover: string;
}> = {
  namespace: 'blog',
  action: 'publishPost',
  title: 'Publish Post',
  description: 'Adds a post, credited to whoever is signed in.',
  params: {
    title: { type: 'text', canBind: true, defaultValue: '', label: 'Title' },
    standfirst: { type: 'text', canBind: true, defaultValue: '', label: 'Standfirst' },
    body: { type: 'codemirror-text', canBind: true, defaultValue: '', label: 'Body (markdown)' },
    topic: { type: 'text', canBind: true, defaultValue: 'Fieldnotes', label: 'Topic' },
    cover: { type: 'text', canBind: true, defaultValue: '', label: 'Cover image URL' }
  },
  run: ({ title, standfirst, body, topic, cover }, ctx) => {
    /**
     * The author is who the SESSION says, never what the browser sent.
     *
     * There is no author field in the form and none in the action's input contract, so there is nothing for a
     * caller to put somebody else's name in. The trigger already refused anyone without the permission; this is
     * the same fact used for the other half of the question — not may you, but who are you.
     */
    const { user } = ctx;
    if (!user) {
      throw new Error('Publishing needs a signed-in author');
    }

    const heading = title.trim();
    if (!heading) {
      throw new Error('A post needs a title');
    }

    const post = addPost({
      title: heading,
      standfirst: standfirst.trim(),
      body,
      topic: topic.trim() || 'Fieldnotes',
      cover: cover.trim(),
      authorId: user.id,
      author: user.username
    });

    return { url: `/post/${post.slug}`, slug: post.slug, message: `Published “${post.title}”` };
  }
};

/**
 * Changing a post that is already published.
 *
 * The counterpart to publishing, and the one that shows the half a permission cannot cover. `access: 'role'` on
 * the trigger already refused anybody without `postPublish` — but `ada` holding that permission does not make
 * `grace`'s post hers to rewrite. So this step asks the second question, with the record in hand, and the store
 * refuses on the author id rather than trusting anything that arrived in the input.
 *
 * A field left blank means "leave it alone", which is what makes the editor safe to open and close.
 */
export const updatePostTask: ActionTask<{
  slug: string;
  title: string;
  standfirst: string;
  body: string;
  topic: string;
  cover: string;
}> = {
  namespace: 'blog',
  action: 'updatePost',
  title: 'Update Post',
  description: 'Rewrites a post the signed-in author already owns.',
  params: {
    slug: { type: 'text', canBind: true, defaultValue: '', label: 'Slug' },
    title: { type: 'text', canBind: true, defaultValue: '', label: 'Title' },
    standfirst: { type: 'text', canBind: true, defaultValue: '', label: 'Standfirst' },
    body: { type: 'codemirror-text', canBind: true, defaultValue: '', label: 'Body (markdown)' },
    topic: { type: 'text', canBind: true, defaultValue: '', label: 'Topic' },
    cover: { type: 'text', canBind: true, defaultValue: '', label: 'Cover image URL' }
  },
  run: ({ slug, title, standfirst, body, topic, cover }, ctx) => {
    const { user } = ctx;
    if (!user) {
      throw new Error('Editing needs a signed-in author');
    }

    const post = updatePost(slug, user.id, { title, standfirst, body, topic, cover });
    if (!post) {
      // The same answer for "no such post" and "not yours" ON PURPOSE: telling the difference apart is telling a
      // stranger which slugs exist and who wrote them.
      throw new Error('That post is not yours to edit');
    }

    return { url: `/post/${post.slug}`, slug: post.slug, message: `Updated “${post.title}”` };
  }
};

/**
 * A write anybody may make.
 *
 * The third access level this blog demonstrates, and the one most sites actually need first: `publish-post` is a
 * ROLE, `update-post` is a role plus ownership, and this is PUBLIC — no session, no permission, no account. It is
 * still a server action, which is the point: the count lives on the server, the browser is told the new number
 * rather than trusted with it, and there is nothing in the page to edit.
 */
/**
 * The one write anybody may make, and the one that has to hold to "once each" without an account.
 *
 * `ctx.callerId` is who the server decided is asking — the same identity the endpoint keys single-flight and
 * cancellation by. It is here rather than in `blog.getPost` on purpose: a `render` trigger's answer is SHARED
 * between the visitors asking for it at the same moment, so a field that differs per anonymous reader would
 * occasionally be handed to the wrong one. A write is never shared, which makes it the only honest place to ask
 * who is writing.
 */
export const recordSightingTask: ActionTask<{ slug: string }> = {
  namespace: 'blog',
  action: 'recordSighting',
  title: 'Record Sighting',
  description: 'One more reader who has seen this animal — once per reader.',
  params: { slug: { type: 'text', canBind: true, defaultValue: '', label: 'Slug' } },
  run: ({ slug }, ctx) => {
    // A slug nobody wrote a post for would otherwise open a counter for anything a caller cared to name.
    if (!findPost(slug)) {
      throw new Error('No such post');
    }

    const { count, added } = recordSighting(slug, ctx.callerId);

    return {
      count,
      label: sightingLabel(count),
      logged: added,
      // The second press is not an error — the reader did nothing wrong and the count is still the answer. It
      // says which of the two happened, because a button that reads "Logged." again is a button people press a
      // third time.
      message: added ? `Logged. ${sightingLabel(count)}.` : `You have already logged this one. ${sightingLabel(count)}.`
    };
  }
};

export const blogTasks = [
  listPostsTask,
  getPostTask,
  siteChromeTask,
  publishPostTask,
  updatePostTask,
  recordSightingTask
];
