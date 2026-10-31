import Alert from '@plitzi/plitzi-ui/Alert';

import type { ReactNode } from 'react';

/**
 * `info` says how something works; `caution` asks for a look — calm, nothing broke; `danger` is for what did break,
 * and only that; `success` says something went through.
 */
export type NoticeTone = 'info' | 'caution' | 'danger' | 'success';

export type NoticeProps = {
  children: ReactNode;
  tone?: NoticeTone;
  /** Where to go for more, as a link after the words. */
  link?: { label: string; href: string };
  /** Closed by the person: a notice they may dismiss. */
  onClose?: () => void;
  className?: string;
};

const INTENT = { info: 'info', caution: 'warning', danger: 'error', success: 'success' } as const;

/**
 * Something said beside where it matters — the one way the builder says it: one size, soft, in one of four tones.
 */
const Notice = ({ children, tone = 'info', link, onClose, className }: NoticeProps) => (
  // Announced as it appears — what broke at once, the rest politely; `Alert` itself says nothing to a reader.
  <div role={tone === 'danger' ? 'alert' : 'status'} className={className}>
    <Alert intent={INTENT[tone]} size="sm" solid={false} closeable={onClose !== undefined} onClick={onClose}>
      {children}
      {link && (
        <>
          {' '}
          <a href={link.href} target="_blank" rel="noreferrer noopener" className="font-medium underline">
            {link.label}
          </a>
        </>
      )}
    </Alert>
  </div>
);

export default Notice;
