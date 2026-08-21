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
  /** One line under the title, on the card and on the post. */
  standfirst: string;
  /** Markdown. The page renders it through `richText`, which strips scripts and handlers before it does. */
  body: string;
  topic: string;
  authorId: number;
  author: string;
  authorRole: string;
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
  standfirst: string;
  /** Ready to put in a link's `href`: a detail page's route is the blog's business, not the browser's. */
  url: string;
  topic: string;
  author: string;
  authorRole: string;
  /** One letter, for the avatar the page draws in CSS — no image to load and nothing to go missing. */
  initial: string;
  date: string;
  readingTime: string;
  /** Date and reading time, for the places that show the author separately. */
  dateline: string;
  byline: string;
  cover: string;
  excerpt: string;
  body: string;
};

export type PageInfo = {
  page: number;
  pageCount: number;
  total: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
};

const PER_PAGE = 4;

const DATE = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' });

const posts: Post[] = [
  {
    id: 1,
    slug: 'a-page-that-arrives-finished',
    title: 'A page that arrives finished',
    standfirst: 'The list you are looking at was resolved before the browser saw a single byte of it.',
    body: `Most sites are a shell and a promise. The HTML arrives, then JavaScript arrives, then a request goes out, then — if the network is kind — the content appears. Everybody has learned to read the grey rectangles.

This page is not that. The list of posts on the home page is produced by a **server action**: a flow the server runs while it is building the page, named by the element that displays the result.

## What that changes

Three things, and none of them are performance tricks:

- The browser makes **no request** for the content. It is in the document.
- There is **no key, no endpoint and no query cost** in the page, because the fetch never happened there.
- A crawler, a link preview and a reader on a train all see the same thing: the finished page.

> The element names an action. It never learns what the action reached, and it could not repeat it if it wanted to.

## And the part people miss

The section is still yours after that. Once the page hydrates, the browser takes it over — the pager below works, a post opens without a reload, and coming back to the list re-reads it. Server-rendered is about **where the data is resolved**, not about giving up the page.`,
    topic: 'Rendering',
    authorId: 1,
    author: 'Ada Bell',
    authorRole: 'Editor',
    publishedAt: '2026-08-19T09:00:00.000Z'
  },
  {
    id: 2,
    slug: 'the-button-that-does-real-work',
    title: 'The button that does real work',
    standfirst: 'Pricing, charging, publishing — the things a browser must not be trusted with.',
    body: `A form is easy. What is hard is everything on the other side of it: the price nobody may edit, the charge that must happen once, the record only some people may create.

A server action is a **document**, not code. It has a trigger — the way in — and a chain of steps. The page hands over a name and some values and gets back whatever the flow's last step chose to answer.

## The whole of it

\`\`\`
trigger  call     who may start this, and what they may send
task     blog.publishPost
output   { url, slug, message }
\`\`\`

What the output step names is exactly what the caller receives. A field the page must never see is a field the **task** does not return — there is no second contract to keep in step, and nothing that can quietly disagree with the first.

## Undeclared input is dropped

Before a single step runs. That is what makes interpolating a caller's values into a later step safe at all, and it is why the author of a post cannot be smuggled in: the contract has no field for it.`,
    topic: 'Engineering',
    authorId: 1,
    author: 'Ada Bell',
    authorRole: 'Editor',
    publishedAt: '2026-08-18T09:00:00.000Z'
  },
  {
    id: 3,
    slug: 'who-may-publish',
    title: 'Who may publish',
    standfirst: 'Signing in is one question. Being allowed to do a thing is another one entirely.',
    body: `Grace has an account. She can sign in, read everything, and open the editor. She cannot publish, and the reason is worth being precise about: the action she would be starting declares the permission it needs, and hers is not on the list.

## Two facts that never meet in the page

- The **account** holds \`postPublish\`, or it does not. That is a property of the person, and it says nothing about any particular space.
- The **action** names that permission on its trigger. The check runs before a single step does, so a refusal costs nothing.

The page does not decide. It shows what came back — which is exactly why hiding a button is a courtesy and never a control:

> A guard the browser enforces is a guard anybody can skip with a terminal open.

## What it looks like from outside

\`\`\`bash
curl -s -X POST /_action -d '{"actionId":"publish-post", ... }'
# 403 {"reason":"forbidden"}
\`\`\`

Same answer for a stranger, for a reader, and for a signed-in account without the permission. The nav above hides the editor link when you may not use it, because a dead end is bad manners — but the lock is the one on the server.`,
    topic: 'Access',
    authorId: 2,
    author: 'Grace Ward',
    authorRole: 'Contributor',
    publishedAt: '2026-08-17T09:00:00.000Z'
  },
  {
    id: 4,
    slug: 'a-layout-is-not-a-template',
    title: 'A layout is not a template',
    standfirst: 'Every page here is a tree of elements with bindings. There is no template language anywhere.',
    body: `The card you clicked has four fields in it: a title, a byline, a topic and an excerpt. None of them is written in the page. Each is a **binding** — an element attribute pointed at a field of a data source.

That has a consequence people find surprising at first: the byline is composed on the **server**, because a binding names one field, and "Ada Bell · 19 August 2026 · 3 min" is three. Build it where the data is and the page stays a layout.

## What the page holds instead

- Elements, their attributes, and which class each one uses.
- Bindings, by source and field.
- Flows, as steps.

That is a document. It can be edited in a visual builder, generated by an agent, reviewed in a pull request, or — as here — written by hand in a file that reads like the page it makes.

## And the styling

Classes, written once and reused, in the space's own stylesheet. The blog you are reading defines about thirty of them and nothing anywhere is styled inline.`,
    topic: 'Design',
    authorId: 1,
    author: 'Ada Bell',
    authorRole: 'Editor',
    publishedAt: '2026-08-15T09:00:00.000Z'
  },
  {
    id: 5,
    slug: 'the-url-is-the-input',
    title: 'The URL is the input',
    standfirst: 'A detail page needs no wiring between its route and the flow that feeds it.',
    body: `This post lives at \`/post/the-url-is-the-input\`, and the page that renders it is authored with the slug \`post/{{slug}}\`. The router turns that into a route parameter.

Here is the part that costs nothing: a render trigger's input **is** the page's own route and query parameters. So the action reads \`{{input.slug}}\` and there is nothing between the two to configure, forget, or get wrong.

## The same trick pages the list

The pager writes \`?page=2\` into the address bar. The action reads \`{{input.page}}\`. Both halves name the same parameter and that is the whole of their agreement — which is why the window is shareable, indexable, and survives the back button.

## When there is nothing there

A slug nobody wrote a post for answers with a page that says so, because the flow returns both the record and whether it found one. Two bindings, no branch.`,
    topic: 'Rendering',
    authorId: 2,
    author: 'Grace Ward',
    authorRole: 'Contributor',
    publishedAt: '2026-08-12T09:00:00.000Z'
  },
  {
    id: 6,
    slug: 'six-files',
    title: 'Six files',
    standfirst: 'What a whole blog costs when the routing, the sessions and the rendering are not yours to write.',
    body: `This site is six files. One of them is the posts, one is the pages, and the other four are under two hundred lines put together.

There is no router in it. No controllers, no templates, no data-loading code, no session handling, no CSRF, no permission middleware, no client state and no build step for the pages. Those are not omissions — they are what \`createAuth\` and \`createServer\` already are.

## The parts that are actually yours

- **Where the posts live.** An array here; a table in yours.
- **What the server can do.** Three tasks, forty-eight lines: list, read, publish.
- **Who the people are.** An adapter over whatever you already keep them in.

Everything else is configuration, and most of it is one line: an action's name on the element that shows its result.`,
    topic: 'Product',
    authorId: 1,
    author: 'Ada Bell',
    authorRole: 'Editor',
    publishedAt: '2026-08-08T09:00:00.000Z'
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

const plainText = (body: string): string =>
  body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_>`-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const excerptOf = (body: string): string => {
  const plain = plainText(body);

  return plain.length > 180 ? `${plain.slice(0, 180).trimEnd()}…` : plain;
};

const readingTime = (body: string): string => `${Math.max(1, Math.round(plainText(body).split(' ').length / 220))} min`;

/**
 * A cover, drawn from the post's own slug.
 *
 * An SVG data URI rather than a photograph, and deliberately: an example that is shown in a room with bad wifi
 * must not be a page of broken images, and a demo blog should not need a media library before it has a post. The
 * hue comes from the slug, so a post always wears the same colours and a new one gets a cover the moment it is
 * written. A real blog stores the URL its editor produced, in exactly this field.
 */
const hue = (slug: string): number => {
  let acc = 0;
  for (let index = 0; index < slug.length; index += 1) {
    acc = (acc * 31 + slug.charCodeAt(index)) % 360;
  }

  return acc;
};

const coverFor = (slug: string): string => {
  const base = hue(slug);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 900'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
<stop offset='0' stop-color='hsl(${base}, 74%, 63%)'/><stop offset='1' stop-color='hsl(${(base + 42) % 360}, 62%, 38%)'/>
</linearGradient></defs>
<rect width='1200' height='900' fill='url(#g)'/>
<circle cx='250' cy='190' r='300' fill='#ffffff' fill-opacity='0.12'/>
<circle cx='980' cy='250' r='120' fill='#ffffff' fill-opacity='0.16'/>
<path d='M0 700 Q 300 560 620 660 T 1200 590 L1200 900 L0 900 Z' fill='#000000' fill-opacity='0.14'/>
<path d='M0 790 Q 340 690 660 770 T 1200 720 L1200 900 L0 900 Z' fill='#ffffff' fill-opacity='0.10'/>
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\n/g, ''))}`;
};

export const view = (post: Post): PostView => ({
  slug: post.slug,
  title: post.title,
  standfirst: post.standfirst,
  url: `/post/${post.slug}`,
  topic: post.topic,
  author: post.author,
  authorRole: post.authorRole,
  initial: post.author.slice(0, 1).toUpperCase(),
  date: DATE.format(new Date(post.publishedAt)),
  readingTime: readingTime(post.body),
  dateline: `${DATE.format(new Date(post.publishedAt))} · ${readingTime(post.body)}`,
  byline: `${post.author} · ${DATE.format(new Date(post.publishedAt))} · ${readingTime(post.body)}`,
  cover: coverFor(post.slug),
  excerpt: excerptOf(post.body),
  body: post.body
});

export type PostWindow = {
  records: PostView[];
  /** The newest post, for the page that leads with it. An empty object when there is none to lead with. */
  featured: PostView | Record<string, never>;
  hasFeatured: boolean;
  isEmpty: boolean;
  pageInfo: PageInfo;
};

/**
 * Newest first, one window at a time.
 *
 * `featured` is what the home page leads with, and it is taken OUT of the window when asked for — a lead story
 * repeated three inches below it is the sort of detail that makes a site look automated.
 */
export const listPosts = ({ page = 1, perPage = PER_PAGE, featured = false } = {}): PostWindow => {
  const ordered = [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const lead = featured && ordered.length > 0 ? ordered[0] : undefined;
  const rest = lead ? ordered.slice(1) : ordered;
  const pageCount = Math.max(Math.ceil(rest.length / perPage), 1);
  const current = Math.min(Math.max(page, 1), pageCount);
  const start = (current - 1) * perPage;
  const records = rest.slice(start, start + perPage).map(view);

  return {
    records,
    // Only ever on the first window: page two of a blog is a list, not a front page.
    featured: lead && current === 1 ? view(lead) : {},
    hasFeatured: Boolean(lead) && current === 1,
    isEmpty: records.length === 0 && !lead,
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

/** The posts around this one, for the "keep reading" strip. Never the one being read. */
export const otherPosts = (slug: string, limit = 3): PostView[] =>
  [...posts]
    .filter(post => post.slug !== slug)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit)
    .map(view);

export const topics = (): { name: string; count: string; url: string }[] => {
  const counted = posts.reduce<Record<string, number>>((acum, post) => {
    acum[post.topic] = (acum[post.topic] ?? 0) + 1;

    return acum;
  }, {});

  return Object.entries(counted)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count: String(count), url: '/' }));
};

export const addPost = (draft: {
  title: string;
  standfirst: string;
  body: string;
  topic: string;
  authorId: number;
  author: string;
}): Post => {
  const post: Post = {
    id: Math.max(0, ...posts.map(item => item.id)) + 1,
    slug: freeSlug(draft.title),
    title: draft.title,
    standfirst: draft.standfirst,
    body: draft.body,
    topic: draft.topic,
    authorId: draft.authorId,
    author: draft.author,
    authorRole: 'Author',
    publishedAt: new Date().toISOString()
  };

  posts.push(post);

  return post;
};
