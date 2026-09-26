import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { encode } from 'uqr';

import { RootElement, useElement, usePlitziServiceContext } from '@plitzi/plitzi-sdk';

import './ShareCard.css';

import declaration from './declaration';

import type { InteractionCallback } from '@plitzi/plitzi-sdk';

export type ShareCardProps = {
  /** What to share. Empty is the address the page is at — which only the browser knows. */
  url?: string;
  copyLabel?: string;
  shareLabel?: string;
  className?: string;
};

const TRIGGERS: Record<string, InteractionCallback> = declaration.triggers;

/** The QR code as one SVG path: a square per dark module, drawn in whatever colour the card is. */
const qrPath = (text: string): { path: string; size: number } => {
  const { data, size } = encode(text, { ecc: 'M', border: 2 });
  const path = data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ''))).join('');

  return { path, size };
};

/**
 * The share card. Rendered on the server without a code — the server does not know which address the visitor typed
 * — and completed in the browser the moment it mounts.
 */
const ShareCard = ({ url = '', copyLabel = 'Copy link', shareLabel = 'Share…', className }: ShareCardProps) => {
  const { id } = useElement();
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const [address, setAddress] = useState(url);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setAddress(url || window.location.href);
    setCanShare(typeof navigator.share === 'function');
  }, [url]);

  const code = useMemo(() => (address ? qrPath(address) : undefined), [address]);

  const copy = useCallback(async () => {
    if (!address) {
      return;
    }

    await navigator.clipboard.writeText(address);
    void interactionsManager.interactionTrigger(id, declaration.triggers.onCopied.action, { url: address });
  }, [address, id, interactionsManager]);

  const share = useCallback(() => {
    // Dismissing the sheet rejects; that is the person's answer, not an error.
    void navigator.share({ url: address }).catch(() => undefined);
  }, [address]);

  const callbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({ copy: { ...declaration.callbacks.copy, callback: () => copy() } }),
    [copy]
  );

  return (
    <RootElement
      className={className ? `share-card ${className}` : 'share-card'}
      interactionTriggers={TRIGGERS}
      interactionCallbacks={callbacks}
    >
      <div className="share-card__code">
        {code && (
          <svg viewBox={`0 0 ${code.size} ${code.size}`} role="img" aria-label={`QR code for ${address}`}>
            <rect width={code.size} height={code.size} className="share-card__paper" />
            <path d={code.path} className="share-card__ink" />
          </svg>
        )}
      </div>
      <output className="share-card__address">{address}</output>
      <div className="share-card__actions">
        <button type="button" className="share-card__button" onClick={() => void copy()}>
          {copyLabel}
        </button>
        {canShare && (
          <button type="button" className="share-card__button share-card__button--quiet" onClick={share}>
            {shareLabel}
          </button>
        )}
      </div>
    </RootElement>
  );
};

export default ShareCard;
