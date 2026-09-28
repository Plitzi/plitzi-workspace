import { use, useCallback, useMemo } from 'react';

import { RootElement, useElement, usePlitziServiceContext, useStore } from '@plitzi/plitzi-sdk';

import './CopyText.css';

import declaration from './declaration';

import type { InteractionCallback } from '@plitzi/plitzi-sdk';

export type CopyTextProps = {
  /**
   * What to copy, shown as it is. `{url}` in it is the address the page is at, and `{origin}` the site's — which only
   * the browser knows: a server behind a proxy does not know the address people reach it by.
   */
  text?: string;
  /** What the button says. */
  label?: string;
  /**
   * The whole of it one small button: the text, and a mark that says a click copies it — for something short that is
   * copied often, like a board's id beside its name. `label` is then what it says to a screen reader and on hover.
   */
  compact?: boolean;
  className?: string;
};

const TRIGGERS: Record<string, InteractionCallback> = declaration.triggers;

/**
 * A line of text and a button that puts it on the clipboard — a command to paste, a sentence to send. `{url}` and
 * `{origin}` are filled from the navigation the SDK keeps, which the server renders with too: the first paint already
 * shows the address, where filling it in once mounted showed the placeholder first.
 */
const CopyText = ({ text = '', label = 'Copy', compact = false, className }: CopyTextProps) => {
  const { id } = useElement();
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const [[href, origin]] = useStore(['navigation.href', 'navigation.origin']);
  const shown = useMemo(() => text.replaceAll('{url}', href).replaceAll('{origin}', origin), [text, href, origin]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(shown);
    void interactionsManager.interactionTrigger(id, declaration.triggers.onCopied.action, { text: shown });
  }, [id, interactionsManager, shown]);

  const classes = [compact ? 'copy-text copy-text--compact' : 'copy-text', className].filter(Boolean).join(' ');

  return (
    <RootElement className={classes} interactionTriggers={TRIGGERS} interactionCallbacks={{}}>
      {compact ? (
        <button type="button" className="copy-text__chip" title={label} aria-label={label} onClick={() => void copy()}>
          <code>{shown}</code>
          <i className="fa-regular fa-copy" aria-hidden="true" />
        </button>
      ) : (
        <>
          <code className="copy-text__text">{shown}</code>
          <button type="button" className="copy-text__button" onClick={() => void copy()}>
            {label}
          </button>
        </>
      )}
    </RootElement>
  );
};

export default CopyText;
