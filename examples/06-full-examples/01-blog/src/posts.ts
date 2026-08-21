/**
 * The posts.
 *
 * This is the only file in the example that knows what a post IS, and the only one a real blog replaces: swap the
 * array for a table and nothing else here changes — not the pages, not the flows, not who may publish. It is kept
 * in memory for the same reason every other example keeps its data in a file: what is worth reading is the wiring,
 * and a database in front of it is a setup step between you and that.
 */

export type Post = {
  id: number;
  slug: string;
  title: string;
  /** Markdown. The page renders it through `richText`, which strips scripts and handlers before it does. */
  body: string;
  authorId: number;
  author: string;
  publishedAt: string;
};

/**
 * What a page actually binds to.
 *
 * Composed HERE, on the server, and that is the point worth copying: a binding names one field, so a byline built
 * from an author and a date is built where the data is rather than assembled out of three bindings and a
 * transformer in the page. The page stays a layout.
 */
export type PostView = {
  slug: string;
  title: string;
  /** Ready to put in a link's `href`: a detail page's route is the blog's business, not the browser's. */
  url: string;
  byline: string;
  excerpt: string;
  body: string;
};

/** The window. Exactly the shape the `pagination` element binds to, which is why nothing translates it. */
export type PageInfo = {
  page: number;
  pageCount: number;
  total: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
};

/** Small enough that three seeded posts already page, which is the only way a pager is worth looking at. */
const PER_PAGE = 2;

const DATE = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' });

const posts: Post[] = [
  {
    id: 1,
    slug: 'hello-plitzi',
    title: 'Hello, Plitzi',
    body: '## A blog, in four pages\n\nThis one lists the posts, another shows one of them, a third is where you write and the last is where you sign in. Every one of them is a **layout** — the data arrives from the server, and the page never learns where from.\n\nThe post you are reading came out of an array in `posts.ts`.',
    authorId: 1,
    author: 'ada',
    publishedAt: '2026-08-19T09:00:00.000Z'
  },
  {
    id: 2,
    slug: 'where-the-data-comes-from',
    title: 'Where the data comes from',
    body: 'The list and this page are both fed by a **server action** — a flow the server runs while it renders, named by the element that shows the result.\n\nSo the browser is handed a finished page. There is no request from it, no API key in it, and nothing to load after it.',
    authorId: 1,
    author: 'ada',
    publishedAt: '2026-08-20T09:00:00.000Z'
  },
  {
    id: 3,
    slug: 'who-may-publish',
    title: 'Who may publish',
    body: 'Signing in is one question and publishing is another.\n\n`grace` has an account and can reach the editor; the action refuses her anyway, because the permission it asks for is not one she holds. The page does not decide that — it only shows what came back.',
    authorId: 2,
    author: 'grace',
    publishedAt: '2026-08-21T09:00:00.000Z'
  }
];

const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** A title somebody already used must not take over its post's URL, so the second one is numbered. */
const freeSlug = (title: string): string => {
  const base = slugify(title) || 'post';
  let candidate = base;
  let suffix = 2;
  while (posts.some(post => post.slug === candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const excerptOf = (body: string): string => {
  const plain = body.replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim();

  return plain.length > 160 ? `${plain.slice(0, 160).trimEnd()}…` : plain;
};

export const view = (post: Post): PostView => ({
  slug: post.slug,
  title: post.title,
  url: `/post/${post.slug}`,
  byline: `${post.author} · ${DATE.format(new Date(post.publishedAt))}`,
  excerpt: excerptOf(post.body),
  body: post.body
});

/** Newest first, one window at a time. `pageInfo` is the shape the `pagination` element reads. */
export const listPosts = (page: number): { records: PostView[]; pageInfo: PageInfo } => {
  const ordered = [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const pageCount = Math.max(Math.ceil(ordered.length / PER_PAGE), 1);
  const current = Math.min(Math.max(page, 1), pageCount);
  const start = (current - 1) * PER_PAGE;

  return {
    records: ordered.slice(start, start + PER_PAGE).map(view),
    pageInfo: {
      page: current,
      pageCount,
      total: ordered.length,
      hasPrevPage: current > 1,
      hasNextPage: current < pageCount
    }
  };
};

export const findPost = (slug: string): Post | undefined => posts.find(post => post.slug === slug);

export const addPost = (draft: { title: string; body: string; authorId: number; author: string }): Post => {
  const post: Post = {
    id: Math.max(0, ...posts.map(item => item.id)) + 1,
    slug: freeSlug(draft.title),
    title: draft.title,
    body: draft.body,
    authorId: draft.authorId,
    author: draft.author,
    publishedAt: new Date().toISOString()
  };

  posts.push(post);

  return post;
};
