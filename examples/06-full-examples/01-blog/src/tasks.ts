import { addPost, findPost, listPosts, view } from './posts';

import type { ActionTask } from '@plitzi/sdk-server/actions';

/**
 * What this blog can do on the server, as three steps its flows chain together.
 *
 * A task is the extension point a deployment owns: registered here, offered in the builder's step catalog, and
 * addressed from a document as `blog.<action>`. Everything Plitzi needed to know about blogging is in this file,
 * and it is thirty lines of it.
 */

/** A lone twig token keeps its type and an embedded one arrives as text, so a numeric param shows up either way. */
const toPage = (value: string | number): number => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export const listPostsTask: ActionTask<{ page: string | number }> = {
  namespace: 'blog',
  action: 'listPosts',
  title: 'List Posts',
  description: 'The published posts, newest first, one page at a time.',
  params: { page: { type: 'text', canBind: true, defaultValue: '1', label: 'Page' } },
  run: ({ page }) => listPosts(toPage(page))
};

export const getPostTask: ActionTask<{ slug: string }> = {
  namespace: 'blog',
  action: 'getPost',
  title: 'Get Post',
  description: 'One post, by the slug in the URL.',
  params: { slug: { type: 'text', canBind: true, defaultValue: '', label: 'Slug' } },
  run: ({ slug }) => {
    const post = findPost(slug);

    /**
     * Both answers, always — and `record` is an object either way.
     *
     * The flow's output step interpolates this whole result into JSON, and a missing value would render as
     * nothing at all: `{"record": }` is not a document, so a URL nobody wrote a post for would fail the run
     * rather than show a page that says so. `found` and `missing` are what the two halves of the page bind their
     * visibility to.
     */
    return { record: post ? view(post) : {}, found: Boolean(post), missing: !post };
  }
};

export const publishPostTask: ActionTask<{ title: string; body: string }> = {
  namespace: 'blog',
  action: 'publishPost',
  title: 'Publish Post',
  description: 'Adds a post, credited to whoever is signed in.',
  params: {
    title: { type: 'text', canBind: true, defaultValue: '', label: 'Title' },
    body: { type: 'codemirror-text', canBind: true, defaultValue: '', label: 'Body (markdown)' }
  },
  run: ({ title, body }, ctx) => {
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

    const post = addPost({ title: heading, body, authorId: user.id, author: user.username });

    return { url: `/post/${post.slug}`, slug: post.slug, message: `Published “${post.title}”` };
  }
};

export const blogTasks = [listPostsTask, getPostTask, publishPostTask];
