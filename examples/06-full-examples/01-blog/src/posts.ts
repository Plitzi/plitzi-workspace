/**
 * The posts.
 *
 * This is the only file in the example that knows what a post IS, and the only one a real blog replaces: swap the
 * array for a table and nothing else here changes — not the pages, not the flows, not who may publish. It is kept
 * in memory for the same reason every other example keeps its data in a file: what is worth reading is the wiring,
 * and a database in front of it is a setup step between you and that.
 */

/**
 * The subject of an article, as facts rather than as prose.
 *
 * This is what the `speciesStatus` plugin renders: a Red List category, which way the population is going, and a
 * series to draw. None of it can be expressed with a heading and a paragraph — a category is a POSITION on a
 * scale, and a trend is a shape — which is exactly when a space stops arranging built-in elements and ships one
 * of its own.
 */
export type Species = {
  name: string;
  latin: string;
  /** IUCN Red List category. The scale the plugin draws runs LC · NT · VU · EN · CR. */
  status: 'LC' | 'NT' | 'VU' | 'EN' | 'CR';
  trend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  /** A population index by decade, oldest first, 100 = the first reading. What the sparkline draws. */
  history: number[];
  /** The first year of the series, so the chart can label its own axis. */
  since: number;
  note: string;
};

export type Post = {
  id: number;
  slug: string;
  title: string;
  /** One line under the title, on the card and on the post. */
  standfirst: string;
  /** Markdown. The page renders it through `richText`, which strips scripts and handlers before it does. */
  body: string;
  /**
   * The photograph, as a URL — which is all a cover ever is.
   *
   * Optional, and that is the interesting half: a post left without one gets a cover drawn from its slug instead.
   * A real blog stores whatever its media library produced, here — and so does the editor on `/write`, which
   * has a field for it and nothing more clever than that.
   */
  cover?: string;
  /** What the article is ABOUT, as data. The one thing on a post no built-in element can draw. */
  species?: Species;
  topic: string;
  authorId: number;
  author: string;
  authorRole: string;
  publishedAt: string;
  /** Set the first time somebody edits it. The post page shows it, so a correction is visible rather than silent. */
  updatedAt?: string;
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
  /** "Updated 22 August 2026", or empty. A blog that edits silently is a blog you cannot trust twice. */
  updated: string;
  wasUpdated: boolean;
  byline: string;
  cover: string;
  excerpt: string;
  body: string;
  /** Present only when the article has a subject. The plugin binds to these four fields. */
  species: Species | Record<string, never>;
  hasSpecies: boolean;
  /** How many readers have said they have seen this animal, as a sentence. */
  sightings: string;
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

/**
 * A photograph, at the size a page actually shows one.
 *
 * Unsplash serves the resizing, so the field holds one URL and the layout is free to put it in a 5:4 hero or a
 * 4:3 card without shipping four files. `auto=format` is the part worth copying: the same URL answers with AVIF,
 * WebP or JPEG depending on who asked.
 */
const photo = (id: string): string => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=72`;

const posts: Post[] = [
  {
    id: 1,
    slug: 'the-fox-that-learned-the-timetable',
    title: 'The fox that learned the timetable',
    standfirst: 'City foxes are not country foxes having a hard time. They are a different animal.',
    cover: photo('photo-1746311189748-5cbe93eaebc0'),
    body: `The vixen we have been following since March crosses the tram line at 04:12, give or take four minutes, six nights a week. Not because she can read the timetable, obviously. Because that is when the last tram has gone and the first one has not come, and she has been alive long enough to know it.

This is the thing that keeps surprising people about urban foxes: they are not refugees. They are residents.

## What the city gave them

A red fox in open country holds a territory of five square kilometres or more and spends most of its waking life covering it. The same animal in a European city holds forty hectares and knows every centimetre.

- **Food density.** A single street of bins outproduces a hectare of grassland, and it does it at the same hour every night.
- **No wolves, no eagles, no lynx.** The only predator that matters is a car, and cars are learnable.
- **Heat.** A city runs two to three degrees warmer. Cubs born in February survive that they would not survive in a hedgerow.

> Give an intelligent generalist a reliable schedule and it will build its whole life around the schedule. That is not adaptation to hardship. That is an animal that has found a better job.

## The part that is genuinely new

Urban foxes are getting shorter snouts and stronger jaw muscles — measurably, across generations, in skulls collected over the last century. Not a big change. But it is the change you would predict for an animal that has stopped catching things and started opening them.

They are not visiting. They have moved in, and the city is starting to show up in the bones.`,
    species: {
      name: 'Red fox',
      latin: 'Vulpes vulpes',
      status: 'LC',
      trend: 'stable',
      history: [100, 104, 112, 126, 138, 141],
      since: 1970,
      note: 'The most widely distributed wild carnivore on Earth, and one of the few getting commoner.'
    },
    topic: 'Cities',
    authorId: 1,
    author: 'Ada Bell',
    authorRole: 'Field editor',
    publishedAt: '2026-08-19T09:00:00.000Z'
  },
  {
    id: 2,
    slug: 'an-arm-that-makes-up-its-own-mind',
    title: 'An arm that makes up its own mind',
    standfirst: 'Two thirds of an octopus’s neurons are not in its head. They are in the arms, and the arms use them.',
    cover: photo('photo-1628944681206-2ee8d63b0a6b'),
    body: `Cut the nerve between an octopus's brain and one of its arms — this has been done, carefully, in laboratories — and the arm goes on solving problems. It reaches. It grips. Handed a piece of food, it passes it along its own length toward a mouth it can no longer be told about.

Half a billion neurons, and only a third of them are central. The rest are distributed down eight limbs that are, functionally, eight semi-independent animals in a committee.

## Why build a mind that way

Because of the body. A vertebrate limb has joints, and a joint means the brain only has to decide a handful of angles. An octopus arm has no joints at all: it can bend anywhere, twist anywhere, in any of an effectively infinite number of configurations.

Nothing could centrally compute that. So nothing does.

The brain issues something closer to an intention than an instruction — *reach toward there* — and the arm works out the rest with its own hardware, running a travelling wave of contraction down its length until it arrives.

## The strange consequence

An octopus appears not to know precisely where its own arms are. There is no detailed body map in the central brain of the kind you and I carry.

> It does not need one. Knowing where the arm is, is the arm's problem.

Which raises the question people who work with these animals eventually stop being able to avoid: when an octopus solves a puzzle box, who exactly solved it?`,
    species: {
      name: 'Common octopus',
      latin: 'Octopus vulgaris',
      status: 'LC',
      trend: 'unknown',
      history: [100, 96, 88, 97, 84, 79],
      since: 1970,
      note: 'Fished heavily and assessed thinly: the category says less here than the size of the error bars.'
    },
    topic: 'Ocean',
    authorId: 2,
    author: 'Grace Ward',
    authorRole: 'Staff writer',
    publishedAt: '2026-08-18T09:00:00.000Z'
  },
  {
    id: 3,
    slug: 'the-herd-remembers-the-drought',
    title: 'The herd remembers the drought',
    standfirst: 'In 1993 the rain failed. The families that survived were the ones with an old enough matriarch.',
    cover: photo('photo-1786982997935-af6db866a8c4'),
    body: `Amboseli, southern Kenya. The drought of 1993 killed around a fifth of the elephants in the park, and it did not kill them evenly. Some family groups walked out of the basin early and lived. Others stayed, and did not.

The difference was the age of the female leading them.

The groups that left were led by matriarchs old enough to have been alive during the drought of 1958–61, when the same thing happened and the survivors went east. The ones that stayed were led by females born after it. They had never seen the sky do this before, and there was nobody in the family who had.

## Memory as infrastructure

An elephant matriarch is not the strongest animal in the group. She is the **archive**.

- Where water was, in a year nobody else present can remember.
- Which lions are worth a defensive formation and which are not — playback experiments show older matriarchs bunch the family for male lion roars and ignore female ones. Younger ones get it wrong.
- Which of the several hundred elephants in the wider population are relatives, from contact calls alone.

## What poaching actually removes

Ivory is bigger in older animals. So the hunting pressure of the last century fell hardest on exactly the individuals carrying the group's memory, and a family that loses its matriarch does not simply promote the next one and carry on.

> It loses the drought of 1958. And it will make the wrong decision the next time the rain fails.

Population counts miss this entirely. You can have the same number of elephants and a great deal less elephant.`,
    species: {
      name: 'African savanna elephant',
      latin: 'Loxodonta africana',
      status: 'EN',
      trend: 'decreasing',
      history: [100, 71, 44, 31, 26, 24],
      since: 1970,
      note: 'Split from the forest elephant as a species in 2021, and listed Endangered the same day.'
    },
    topic: 'Savanna',
    authorId: 1,
    author: 'Ada Bell',
    authorRole: 'Field editor',
    publishedAt: '2026-08-17T09:00:00.000Z'
  },
  {
    id: 4,
    slug: 'eighty-wingbeats-a-second-and-a-nightly-death',
    title: 'Eighty wingbeats a second, and a nightly death',
    standfirst: 'A hummingbird cannot afford to sleep the way you do. So every night it does something else.',
    cover: photo('photo-1633288515406-4cfbb8dec49d'),
    body: `A hovering hummingbird runs the highest mass-specific metabolic rate of any vertebrate that is not a shrew. Its heart passes 1,200 beats a minute. It visits well over a thousand flowers a day and it is, at almost every moment, a few hours from starving.

Then the sun goes down and it cannot feed.

## Torpor

So it switches itself off. Body temperature falls from around 40°C to as low as 18°C. The heart drops from twelve hundred beats a minute to fifty. Breathing becomes intermittent and can stop for minutes at a stretch. Metabolic rate falls by up to 95 per cent.

A hummingbird in torpor is, to any reasonable observer, dead. It will hang upside down from a twig, cold and rigid, and not respond to being touched.

Waking costs it energy it can barely spare and takes twenty minutes of violent shivering. It does this every night of its life.

## The cost of the trick

Torpor is not free sleep, and the birds treat it as a last resort:

- A bird that went to roost with a full crop often does not enter torpor at all.
- A bird that had a bad afternoon goes deeper and stays longer.
- Breeding females are more reluctant than anyone — a cold egg is a dead egg, so a nesting female will burn through her reserves rather than let the clutch drop.

> The bird is running an overnight energy budget with a decision in it, and it makes that decision every evening based on what it managed to eat.

Andean species at 4,000 metres go furthest: measured body temperatures of 3.3°C, the lowest recorded in any bird or non-hibernating mammal. Cold enough that you would put it in the fridge, not the field notebook.`,
    species: {
      name: 'Broad-tailed hummingbird',
      latin: 'Selasphorus platycercus',
      status: 'LC',
      trend: 'decreasing',
      history: [100, 94, 87, 79, 71, 64],
      since: 1970,
      note: 'Least Concern and down by a third: the category is about extinction risk, not about how it is going.'
    },
    topic: 'Flight',
    authorId: 2,
    author: 'Grace Ward',
    authorRole: 'Staff writer',
    publishedAt: '2026-08-15T09:00:00.000Z'
  },
  {
    id: 5,
    slug: 'there-is-no-alpha-wolf',
    title: 'There is no alpha wolf',
    standfirst: 'The man who put the phrase in every dictionary spent thirty years trying to take it back.',
    cover: photo('photo-1517993037474-692208825419'),
    body: `The idea comes from a study of captive wolves in the 1940s: unrelated adults, thrown into an enclosure together, forming a rank order by fighting. David Mech's 1970 book *The Wolf* carried it to a general audience, and from there into dog training, management seminars and a great deal of internet posturing.

Mech has spent the decades since asking people to stop. He has requested that the book go out of print. It keeps being reprinted.

## What a wild pack actually is

A family.

A breeding pair and their offspring from the last two or three years. The "alphas" are the parents, and they lead the way any parents lead — not by winning fights, but by being the ones who have been doing this longer.

Young wolves do not stay and compete for the top job. At one to three years old they leave, find a mate, and start a pack of their own, in which they are the "alpha" by the entirely undramatic method of having had children.

> Calling a wolf parent an alpha is like calling a human parent an alpha. It is not that it is unkind. It is that it explains nothing.

## Why the wrong version survived

Because captive wolves really do behave that way, and because the story is useful to people who want a natural justification for hierarchy.

Put unrelated adults of most social species in a cage and they will sort out a rank order too. What that tells you about the species in the wild is nothing at all — which is the actual lesson here, and it is a much more general one than wolves.`,
    species: {
      name: 'Grey wolf',
      latin: 'Canis lupus',
      status: 'LC',
      trend: 'increasing',
      history: [100, 92, 88, 103, 137, 178],
      since: 1970,
      note: 'A European recovery on top of a century of extermination — the line is a policy, drawn.'
    },
    topic: 'Behaviour',
    authorId: 1,
    author: 'Ada Bell',
    authorRole: 'Field editor',
    publishedAt: '2026-08-13T09:00:00.000Z'
  },
  {
    id: 6,
    slug: 'born-with-the-map-already-in-her',
    title: 'Born with the map already in her',
    standfirst: 'A hatchling that has never been in the sea knows which way to swim, and how far.',
    cover: photo('photo-1709483095301-2d1f3e95b1d4'),
    body: `A loggerhead breaks out of the sand on a Florida beach, crosses fifteen metres of it, and enters an ocean it has no experience of whatsoever. What it does next is a five-year, twelve-thousand-kilometre circuit of the North Atlantic gyre — and it does not drift it. It swims it, correcting whenever the current would carry it out of survivable water.

Nobody taught it. The parents left before it hatched.

## What it is reading

The Earth's magnetic field varies over the surface in two ways that happen to be usefully independent: **inclination**, the angle the field makes with the ground, and **intensity**. Take both together and you have something close to a coordinate pair.

\`\`\`
Florida nesting beach      inclination 57°   intensity 47 µT
North-east Atlantic        inclination 65°   intensity 44 µT
Cape Verde                 inclination 32°   intensity 38 µT
\`\`\`

Put a hatchling in a tank inside a magnetic coil, reproduce the field of a location it has never been to, and it will orient in the direction that would keep it in the gyre *at that location*. Turn the field to the value found off Portugal and it swims south-west. Turn it to the value off the Cape Verde islands and it swims north-west.

## And the long way home

Twenty years later a female comes back to nest within a few dozen kilometres of the beach she hatched on.

The current best explanation is that she imprinted on the magnetic signature of that stretch of coast as a hatchling and spends her adult life searching for the match. It has a testable and slightly unsettling consequence: the field drifts, so the signature moves — and the turtles move with it. When two stretches of Florida coast drifted magnetically closer together, nesting density between them converged.

> They are not going back to a place. They are going back to a number, and the number has been quietly relocating.`,
    species: {
      name: 'Loggerhead turtle',
      latin: 'Caretta caretta',
      status: 'VU',
      trend: 'unknown',
      history: [100, 83, 61, 58, 72, 88],
      since: 1970,
      note: 'Nest counts are rising where beaches are protected and falling where they are not.'
    },
    topic: 'Ocean',
    authorId: 2,
    author: 'Grace Ward',
    authorRole: 'Staff writer',
    publishedAt: '2026-08-11T09:00:00.000Z'
  },
  {
    id: 7,
    slug: 'counting-a-ghost',
    title: 'Counting a ghost',
    standfirst:
      'Nobody knows how many snow leopards there are. The honest answer is a range with a factor of two in it.',
    cover: photo('photo-1698578153726-2114cac67753'),
    body: `The published figure is four to seven thousand. It has been roughly that figure for thirty years, and for most of those years it rested on expert opinion rather than on anything counted.

The animal is the problem. It lives above 3,000 metres across two million square kilometres of some of the least accessible terrain on Earth, in twelve countries, several of which do not agree about where the borders are. It is grey on grey rock. Less than two per cent of its range has been surveyed with methods that would satisfy a statistician.

## What changed

Camera traps and faecal DNA, and — more importantly — the arithmetic that goes with them.

- A cat photographed twice at two stations is one cat, and the rosette pattern on the flank says so. Individual identification is what turns photographs into a population estimate rather than a count of photographs.
- Spatial capture-recapture models estimate how much of the landscape each animal uses, so a survey no longer has to guess the size of the area it just sampled.
- Scat gives you individuals, sex and diet from something you can pick up off a trail without ever seeing the animal.

## Why the number still matters

Because the species was moved from Endangered to Vulnerable in 2017, and that decision was made on population estimates most of the people who work on the animal did not consider solid.

> A downgrade based on a number nobody can defend is not good news. It is the same ignorance, wearing a better label.

The current work — a coordinated assessment across all twelve range states — is the first attempt to answer the question with fieldwork instead of consensus. The first results suggest the old figure was not wildly wrong. That is worth knowing, and it took thirty years to be able to say it.`,
    species: {
      name: 'Snow leopard',
      latin: 'Panthera uncia',
      status: 'VU',
      trend: 'decreasing',
      history: [100, 97, 91, 86, 82, 78],
      since: 1970,
      note: 'Every point on this line is an estimate of an estimate. That is the subject of the article.'
    },
    topic: 'Conservation',
    authorId: 1,
    author: 'Ada Bell',
    authorRole: 'Field editor',
    publishedAt: '2026-08-09T09:00:00.000Z'
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

/**
 * Markdown with the marks taken off, for an excerpt and a word count.
 *
 * The list and heading markers are stripped where they MEAN something — at the start of a line — and nowhere
 * else. Sweeping every `-` out of the text instead turns "mass-specific" into "massspecific" on the front page,
 * which is the sort of thing nobody notices until it is printed.
 */
const plainText = (body: string): string =>
  body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const excerptOf = (body: string): string => {
  const plain = plainText(body);

  return plain.length > 180 ? `${plain.slice(0, 180).trimEnd()}…` : plain;
};

const readingTime = (body: string): string => `${Math.max(1, Math.round(plainText(body).split(' ').length / 220))} min`;

/**
 * A cover for a post that has no photograph.
 *
 * Everything published here carries a real one, but the editor on `/write` has no upload field — so a post
 * written in the demo would otherwise land on the front page as a hole. The hue comes from the slug, which means
 * a new post gets its own colours the moment it is written and keeps them forever, with nothing to fetch.
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
  updated: post.updatedAt ? `Updated ${DATE.format(new Date(post.updatedAt))}` : '',
  wasUpdated: Boolean(post.updatedAt),
  byline: `${post.author} · ${DATE.format(new Date(post.publishedAt))} · ${readingTime(post.body)}`,
  cover: post.cover ?? coverFor(post.slug),
  excerpt: excerptOf(post.body),
  body: post.body,
  // An object either way: the flow's output step interpolates this whole result into JSON, and a missing value
  // would render as nothing at all — `{"species": }` is not a document.
  species: post.species ?? {},
  hasSpecies: Boolean(post.species),
  sightings: sightingLabel(countSightings(post.slug))
});

export type PostWindow = {
  records: PostView[];
  /** The newest post, for the page that leads with it. An empty object when there is none to lead with. */
  featured: PostView | Record<string, never>;
  hasFeatured: boolean;
  isEmpty: boolean;
  /** What the list is currently narrowed to, and whether it is narrowed at all. */
  topic: string;
  filtered: boolean;
  /** Its opposite, for the heading that shows when it is not — a binding has no "unless". */
  unfiltered: boolean;
  filterLabel: string;
  pageInfo: PageInfo;
};

/**
 * Newest first, one window at a time, narrowed to a topic when one was asked for.
 *
 * `featured` is what the home page leads with, and it is taken OUT of the window when asked for — a lead story
 * repeated three inches below it is the sort of detail that makes a site look automated. **A filtered list never
 * leads with one**: a hero above a list of five is a front page, and a hero above a list of two is a mistake.
 */
export const listPosts = ({ page = 1, perPage = PER_PAGE, featured = false, topic = '' } = {}): PostWindow => {
  const wanted = topic.trim().toLowerCase();
  const all = [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const ordered = wanted ? all.filter(post => post.topic.toLowerCase() === wanted) : all;
  const lead = featured && !wanted && ordered.length > 0 ? ordered[0] : undefined;
  const rest = lead ? ordered.slice(1) : ordered;
  const pageCount = Math.max(Math.ceil(rest.length / perPage), 1);
  const current = Math.min(Math.max(page, 1), pageCount);
  const start = (current - 1) * perPage;
  const records = rest.slice(start, start + perPage).map(view);
  // Whatever the reader typed, spelled the way the posts spell it — the chip and the heading say `Ocean`, not
  // whatever case arrived in the URL.
  const label = wanted ? (ordered[0]?.topic ?? topic.trim()) : '';

  return {
    records,
    // Only ever on the first window: page two of a blog is a list, not a front page.
    featured: lead && current === 1 ? view(lead) : {},
    hasFeatured: Boolean(lead) && current === 1,
    isEmpty: records.length === 0 && !lead,
    topic: label,
    filtered: Boolean(wanted),
    unfiltered: !wanted,
    filterLabel: label ? `${label} · ${ordered.length} ${ordered.length === 1 ? 'post' : 'posts'}` : '',
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

/**
 * How many readers have said they have seen this animal.
 *
 * Kept beside the posts rather than on them because it is not the author's field: nobody edits it, and a post
 * that gets rewritten keeps its count. In a real blog this is a table with a row per sighting; here it is a
 * number, for the same reason everything else in this file is in memory.
 */
const sightings: Record<string, number> = {
  'the-fox-that-learned-the-timetable': 41,
  'an-arm-that-makes-up-its-own-mind': 7,
  'the-herd-remembers-the-drought': 12,
  'eighty-wingbeats-a-second-and-a-nightly-death': 63,
  'there-is-no-alpha-wolf': 9,
  'born-with-the-map-already-in-her': 18,
  'counting-a-ghost': 2
};

export const countSightings = (slug: string): number => sightings[slug] ?? 0;

/**
 * Who has already counted, per post.
 *
 * A counter anybody may add to is a counter one person can be the whole of, and "one per reader" is not something
 * the button can promise: a page that disables it has said nothing about the next tab, and a browser is not where
 * a fact about other readers is kept. So the server remembers who, and the seeded numbers above are the readers
 * it has no name for.
 *
 * In a real blog this is a row per sighting with a unique index on (post, reader). Here it is a Set, for the same
 * reason everything else in this file is in memory.
 */
const seenBy: Record<string, Set<string>> = {};

/**
 * One more, from a reader who has not said so before.
 *
 * `reader` is the caller as the server identified them — `user:<id>` for a session, and their address for
 * everybody else, which is the best answer there is for a write that asks for no account. It is coarse on
 * purpose: a shared connection counts once, and that is the failure worth having when the alternative is
 * trusting an identifier the browser sent.
 */
export const recordSighting = (slug: string, reader: string): { count: number; added: boolean } => {
  const readers = (seenBy[slug] ??= new Set());
  if (readers.has(reader)) {
    return { count: countSightings(slug), added: false };
  }

  readers.add(reader);
  sightings[slug] = countSightings(slug) + 1;

  return { count: sightings[slug], added: true };
};

/** "41 readers have seen one" — composed here, because a binding names one field. */
export const sightingLabel = (count: number): string =>
  count === 1 ? '1 reader has seen one of these' : `${count} readers have seen one of these`;

/** The posts around this one, for the "keep reading" strip. Never the one being read. */
export const otherPosts = (slug: string, limit = 3): PostView[] =>
  [...posts]
    .filter(post => post.slug !== slug)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit)
    .map(view);

export type TopicView = {
  name: string;
  count: string;
  /** Where the chip goes. `All` clears the filter by having no query at all rather than by carrying an empty one. */
  url: string;
  /**
   * Which of the two chips this item renders.
   *
   * A field AND its opposite, because a binding shows an element when its field is true and the vocabulary has no
   * "unless" — and because "selected" is a different shape, not a tint on the same one. The list authors both and
   * the binding picks, exactly as the header does for signed in and signed out.
   */
  isActive: boolean;
  isInactive: boolean;
};

/**
 * Every topic, with `All` in front of them, and which one is currently chosen.
 *
 * The counts are computed over ALL the posts rather than over the filtered window: a chip that said `Ocean 2`
 * while you were reading Ocean and `Ocean 0` while you were not would be counting the wrong thing.
 */
export const topics = (active = ''): TopicView[] => {
  const chosen = active.trim().toLowerCase();
  const counted = posts.reduce<Record<string, number>>((acum, post) => {
    acum[post.topic] = (acum[post.topic] ?? 0) + 1;

    return acum;
  }, {});

  const entries = Object.entries(counted)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({
      name,
      count: String(count),
      url: `/?topic=${encodeURIComponent(name)}`,
      isActive: name.toLowerCase() === chosen,
      isInactive: name.toLowerCase() !== chosen
    }));

  return [
    { name: 'All', count: String(posts.length), url: '/', isActive: !chosen, isInactive: Boolean(chosen) },
    ...entries
  ];
};

/**
 * Changing a post that already exists.
 *
 * It takes the AUTHOR's id and refuses a post belonging to somebody else — and that is not the same question the
 * action's trigger asked. The trigger asked "may you publish at all", once, before any step ran. This asks "is
 * this yours", and only a step holding the record can: a permission is about a person, ownership is about a row.
 *
 * `undefined` for a field means "leave it alone", which is what lets one editor send only what changed.
 */
export const updatePost = (
  slug: string,
  authorId: number,
  patch: { title?: string; standfirst?: string; body?: string; topic?: string; cover?: string }
): Post | undefined => {
  const post = posts.find(item => item.slug === slug);
  if (!post || post.authorId !== authorId) {
    return undefined;
  }

  const trimmed = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => typeof value === 'string' && value.trim() !== '')
  ) as Record<string, string>;

  Object.assign(post, trimmed);
  post.updatedAt = new Date().toISOString();

  return post;
};

export const addPost = (draft: {
  title: string;
  standfirst: string;
  body: string;
  topic: string;
  cover: string;
  authorId: number;
  author: string;
}): Post => {
  const post: Post = {
    id: Math.max(0, ...posts.map(item => item.id)) + 1,
    slug: freeSlug(draft.title),
    title: draft.title,
    standfirst: draft.standfirst,
    body: draft.body,
    // Empty is a real answer: `view` falls back to a cover drawn from the slug, so a post without a photograph
    // still has one rather than a hole where the front page expects an image.
    cover: draft.cover ? draft.cover : undefined,
    topic: draft.topic,
    authorId: draft.authorId,
    author: draft.author,
    authorRole: 'Author',
    publishedAt: new Date().toISOString()
  };

  posts.push(post);

  return post;
};
