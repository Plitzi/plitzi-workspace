/**
 * The attribute each type shows its data in — what `from` binds. A type not listed has no one attribute that is its
 * content, and `from` on it is refused.
 */
export const MAIN_ATTRIBUTES: Readonly<Record<string, string>> = {
  text: 'content',
  heading: 'content',
  paragraph: 'content',
  button: 'content',
  markdown: 'content',
  richText: 'content',
  image: 'src',
  video: 'src',
  embed: 'src',
  svg: 'content',
  link: 'href',
  list: 'items',
  carousel: 'items'
};
