import clsx from 'clsx';

export type IconPlacement = 'before' | 'after';

type ElementIconProps = {
  icon: string;
  className?: string;
};

/**
 * Decoration, hidden from screen readers and browser agents: a glyph from an icon font reads as a private-use
 * character. What the button or the link does is named by its words, or its `title` and `label` when it has none.
 *
 * It takes the size of the words, and no space of its own: the space between them is the element's — the `gap` of a
 * flex box, or a margin on the `icon` slot — so a box that lays its children out with a gap is not given two.
 */
const ElementIcon = ({ icon, className }: ElementIconProps) => {
  if (!icon) {
    return null;
  }

  return <i className={clsx('plitzi-element-icon', icon, className)} aria-hidden="true" />;
};

export type ElementWordsProps = {
  /** The element's own words. */
  content?: string;
  /** Font Awesome classes for an icon beside them (`'fa-solid fa-arrow-right'`); empty for none. */
  icon?: string;
  iconPlacement?: IconPlacement;
  /** What the element's `icon` slot carries. */
  iconClassName?: string;
};

/**
 * What a button or a link says itself — its words and an icon beside them, one element instead of a `text` and a
 * `fontAwesome` inside it. Each element places the whole beside its children with its own `contentPlacement`.
 */
const ElementWords = ({ content = '', icon = '', iconPlacement = 'before', iconClassName }: ElementWordsProps) => (
  <>
    {iconPlacement === 'before' && <ElementIcon icon={icon} className={iconClassName} />}
    {content}
    {iconPlacement === 'after' && <ElementIcon icon={icon} className={iconClassName} />}
  </>
);

export default ElementWords;
