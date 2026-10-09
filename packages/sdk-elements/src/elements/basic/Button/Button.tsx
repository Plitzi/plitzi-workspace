/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';

import ElementWords from '../../../Element/ElementWords';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { IconPlacement } from '../../../Element/ElementWords';
import type { ReactNode, RefObject } from 'react';

export type ButtonProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  contentPlacement?: 'before' | 'after';
  content?: string;
  /**
   * An icon beside the words, as Font Awesome classes — `'fa-solid fa-arrow-right'` — instead of a `fontAwesome`
   * element inside. Decoration: the words (or `title`/`label`) name it. Its `icon` slot styles it.
   */
  icon?: string;
  /** Which side of the words the icon sits on. */
  iconPlacement?: IconPlacement;
  subType?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /**
   * For a button that shows and hides something — a menu, an answer, a panel: `true` while that is open.
   *
   * Left out, the button claims to control nothing, which is not the same as `false` ("it controls something, and it
   * is closed"). A screen reader announces the difference, so an ordinary button must not get a default here.
   */
  ariaExpanded?: boolean;
  /** For a button that stays on or off — a filter, a mode: `true` while it is on. Left out, it is a plain button. */
  ariaPressed?: boolean;
  /**
   * What the button shows and hides — an accordion's panel, a menu — by its anchor (`aria-controls`), so a screen
   * reader can go from one to the other. Authoring takes the element's id and gives that element the anchor.
   */
  controls?: string;
  /**
   * What the button does, in words — shown as a tooltip on hover, and the button's accessible name when it has no text
   * of its own. An icon-only button without one is announced as nothing at all.
   *
   * The browser falls back to it by itself, so it is never copied into `aria-label` — and neither is `content`: the
   * button's name is what it SHOWS, content and children together. An `aria-label` taken from `content` named a button
   * whose words were among its children after the default "Button" instead.
   */
  title?: string;
  /**
   * The button's name, for when the words it shows do not say what it does: a key hint beside an icon ("V"), a count,
   * an arrow. Read in place of everything inside it by screen readers and browser agents, so it says the whole of it —
   * "Select (V)". Left empty, the button is named by what it shows, then by `title`.
   */
  label?: string;
};

const Button = ({
  ref,
  className = '',
  children,
  contentPlacement = 'after',
  content = 'Button',
  icon = '',
  iconPlacement = 'before',
  subType = 'button',
  disabled = false,
  ariaExpanded,
  ariaPressed,
  controls,
  title,
  label
}: ButtonProps) => {
  const {
    settings: { previewMode }
  } = usePlitzi();
  const {
    definition: { styleSelectors }
  } = useElement();

  return (
    <RootElement
      ref={ref}
      tag="button"
      type={previewMode ? subType : 'button'}
      className={clsx('plitzi-component__button', className, {
        'container--empty--skip': !previewMode && !children && (content || icon)
      })}
      disabled={disabled}
      title={title || undefined}
      aria-label={label || undefined}
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
      aria-controls={controls || undefined}
    >
      <ElementWords
        content={content}
        icon={icon}
        iconPlacement={iconPlacement}
        iconClassName={styleSelectors.icon}
        contentPlacement={contentPlacement}
      >
        {children}
      </ElementWords>
    </RootElement>
  );
};

export default withElement(Button);

export { Button };
