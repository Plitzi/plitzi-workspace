import { use, useCallback, useEffect, useState } from 'react';

import { RootElement, useElement, usePlitziServiceContext } from '@plitzi/plitzi-sdk';

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
  className?: string;
};

const TRIGGERS: Record<string, InteractionCallback> = declaration.triggers;

/**
 * A line of text and a button that puts it on the clipboard — a command to paste, a sentence to send. Rendered on the
 * server with `{url}` and `{origin}` left as they are, and completed in the browser the moment it mounts.
 */
const CopyText = ({ text = '', label = 'Copy', className }: CopyTextProps) => {
  const { id } = useElement();
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const [shown, setShown] = useState(text);

  useEffect(() => {
    setShown(text.replaceAll('{url}', window.location.href).replaceAll('{origin}', window.location.origin));
  }, [text]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(shown);
    void interactionsManager.interactionTrigger(id, declaration.triggers.onCopied.action, { text: shown });
  }, [id, interactionsManager, shown]);

  return (
    <RootElement
      className={className ? `copy-text ${className}` : 'copy-text'}
      interactionTriggers={TRIGGERS}
      interactionCallbacks={{}}
    >
      <code className="copy-text__text">{shown}</code>
      <button type="button" className="copy-text__button" onClick={() => void copy()}>
        {label}
      </button>
    </RootElement>
  );
};

export default CopyText;
