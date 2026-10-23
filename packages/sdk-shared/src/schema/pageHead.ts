import { isRecord } from '../helpers/isRecord';

import type { Schema } from '../types';

/**
 * What a page's head says of it to whoever shows a link to it — a chat's preview card, a social post, a search result —
 * and to the browser around it: one definition, read by the server that writes the document (what a link preview reads,
 * never running the page) and by the page itself as it moves (`PageHead`), so the two never say different things.
 */

/** The kinds of page Open Graph names (`og:type`), as ogp.me lists them. */
export const OG_TYPES = [
  'website',
  'article',
  'profile',
  'book',
  'music.song',
  'music.album',
  'music.playlist',
  'music.radio_station',
  'video.movie',
  'video.episode',
  'video.tv_show',
  'video.other'
] as const;

export type OgType = (typeof OG_TYPES)[number];

export const isOgType = (value: unknown): value is OgType =>
  typeof value === 'string' && (OG_TYPES as readonly string[]).includes(value);

/** The space's own settings a head reads: who the site is, beside each page. */
export type SpaceIdentity = Pick<Schema['settings'], 'siteName' | 'language' | 'favicon' | 'shareImage' | 'themeColor'>;

/** What one page says of itself, its templates already read: its own words, and its picture. */
export interface PageHeadFacts {
  title?: string;
  description?: string;
  robots?: string;
  image?: string;
  imageAlt?: string;
  type?: OgType;
}

/** A `<meta>` of the head: by `name` (description, twitter:…) or by `property` (Open Graph's). */
export interface HeadMeta {
  attribute: 'name' | 'property';
  key: string;
  content: string;
  /** For `theme-color` a scheme: `(prefers-color-scheme: dark)`. */
  media?: string;
}

/** A `<link>` of the head: the page's own address, the tab's icon. */
export interface HeadLink {
  rel: string;
  href: string;
  type?: string;
}

export interface PageHeadTags {
  meta: HeadMeta[];
  links: HeadLink[];
  /** `<html lang>`, when the space says its language. */
  lang?: string;
}

/** A language tag as BCP 47 writes the common ones: `en`, `es-MX`, `zh-Hant-TW`. */
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** A file of the site (`/og.png`) or an address on the web — what a head may point a reader at. */
const SITE_PATH = /^\/(?!\/)[^\s"'<>]*$/;
const WEB_ADDRESS = /^https?:\/\/[^\s"'<>]+$/;

/** A colour the browser reads in a meta — hex, or a CSS colour function. Words like `red` are left to CSS. */
const COLOUR =
  /^(#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([^()]*\))$/;

/** Whether a value names a file of the site or an address: what `favicon`, `shareImage` and a page's image take. */
export const isHeadAddress = (value: string): boolean => SITE_PATH.test(value) || WEB_ADDRESS.test(value);

/**
 * An address as a reader outside the page needs it: whole. A chat's preview never resolves `/og.png` against the page,
 * so a file of the site is written with the origin the request came to; an address stays as it is.
 */
export const absoluteAddress = (value: string, origin: string): string =>
  SITE_PATH.test(value) && origin !== '' ? `${origin.replace(/\/$/, '')}${value}` : value;

/** `og:locale` writes a language with an underscore: `es-MX` is `es_MX`. */
const ogLocale = (language: string): string => language.replace(/-/g, '_');

/**
 * What is wrong with the space's identity settings, each said with its fix — authoring refuses on them and the builder
 * shows them as they are typed. None when they are right.
 */
export const spaceIdentityProblems = (settings: SpaceIdentity): string[] => {
  const problems: string[] = [];
  const { siteName, language, favicon, shareImage, themeColor } = settings;
  if (siteName !== undefined && siteName.trim() === '') {
    problems.push('siteName is empty: leave it out, or name the site.');
  }

  if (language !== undefined && !LANGUAGE.test(language)) {
    problems.push(`language "${language}" is no language tag: \`en\`, \`es\`, \`es-MX\`.`);
  }

  for (const [name, value] of [
    ['favicon', favicon],
    ['shareImage', shareImage]
  ] as const) {
    if (value !== undefined && !isHeadAddress(value)) {
      problems.push(
        `${name} "${value}" is neither a file of the site nor an address: \`/${name === 'favicon' ? 'favicon.svg' : 'og.png'}\` (in public/), or \`https://…\`.`
      );
    }
  }

  const colours =
    themeColor === undefined
      ? []
      : typeof themeColor === 'string'
        ? [['themeColor', themeColor]]
        : Object.entries(themeColor).map(([scheme, colour]) => [`themeColor.${scheme}`, colour]);
  if (isRecord(themeColor) && Object.keys(themeColor).some(scheme => scheme !== 'light' && scheme !== 'dark')) {
    problems.push('themeColor is one colour, or one a scheme: `{ light: "#ffffff", dark: "#09090b" }`.');
  }

  for (const [name, colour] of colours) {
    if (typeof colour !== 'string' || !COLOUR.test(colour.trim())) {
      problems.push(`${name} ${JSON.stringify(colour)} is no colour a browser reads here: \`#ff6a3d\`, \`oklch(…)\`.`);
    }
  }

  return problems;
};

/** The type a picture's address says it is, for the tab's icon. */
const iconType = (href: string): string | undefined => {
  const path = href.split(/[?#]/)[0] ?? '';
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();

  return { svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', webp: 'image/webp' }[extension];
};

/** Plitzi's own icon: the tab of a space that names none. */
export const DEFAULT_FAVICON = 'https://cdn.plitzi.com/resources/img/favicon.svg';

/**
 * Every tag a page's head carries besides its title and its JSON-LD: its description, its robots, its Open Graph and
 * card — the title, the description, the picture and its words, the kind, the site, the language, the page's own
 * address — the tab's icon and the browser's colour. `url` is the page's whole address, without its query: what a
 * preview names as the link, and the canonical one. A picture of the site is made whole against its origin.
 */
export const pageHeadTags = (page: PageHeadFacts, space: SpaceIdentity, url: string): PageHeadTags => {
  const origin = /^https?:\/\/[^/]+/.exec(url)?.[0] ?? '';
  const image = page.image ?? space.shareImage;
  const imageUrl = image && isHeadAddress(image) ? absoluteAddress(image, origin) : undefined;
  const meta: HeadMeta[] = [];
  const add = (attribute: HeadMeta['attribute'], key: string, content: string | undefined, media?: string) => {
    if (content !== undefined && content.trim() !== '') {
      meta.push({ attribute, key, content: content.trim(), ...(media ? { media } : {}) });
    }
  };

  add('name', 'description', page.description);
  add('name', 'robots', page.robots);
  add('property', 'og:type', page.type ?? 'website');
  add('property', 'og:title', page.title);
  add('property', 'og:description', page.description);
  add('property', 'og:site_name', space.siteName);
  add('property', 'og:url', url);
  add('property', 'og:locale', space.language ? ogLocale(space.language) : undefined);
  add('property', 'og:image', imageUrl);
  add('property', 'og:image:alt', imageUrl ? page.imageAlt : undefined);
  add('name', 'twitter:card', imageUrl ? 'summary_large_image' : 'summary');
  add('name', 'twitter:title', page.title);
  add('name', 'twitter:description', page.description);
  add('name', 'twitter:image', imageUrl);
  add('name', 'twitter:image:alt', imageUrl ? page.imageAlt : undefined);
  const { themeColor } = space;
  if (typeof themeColor === 'string') {
    add('name', 'theme-color', themeColor);
  } else if (themeColor) {
    add('name', 'theme-color', themeColor.light, '(prefers-color-scheme: light)');
    add('name', 'theme-color', themeColor.dark, '(prefers-color-scheme: dark)');
  }

  const favicon = space.favicon && isHeadAddress(space.favicon) ? space.favicon : DEFAULT_FAVICON;
  const faviconType = iconType(favicon);
  const links: HeadLink[] = [
    ...(url !== '' ? [{ rel: 'canonical', href: url }] : []),
    { rel: 'icon', href: favicon, ...(faviconType ? { type: faviconType } : {}) }
  ];

  return { meta, links, ...(space.language && LANGUAGE.test(space.language) ? { lang: space.language } : {}) };
};

/** The space's identity, read off its settings: only what each is, never another setting. */
export const spaceIdentity = (settings: Partial<Schema['settings']> | undefined): SpaceIdentity => {
  const { siteName, language, favicon, shareImage, themeColor } = settings ?? {};

  return {
    ...(typeof siteName === 'string' ? { siteName } : {}),
    ...(typeof language === 'string' ? { language } : {}),
    ...(typeof favicon === 'string' ? { favicon } : {}),
    ...(typeof shareImage === 'string' ? { shareImage } : {}),
    ...(themeColor !== undefined ? { themeColor } : {})
  };
};
