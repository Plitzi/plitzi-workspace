import type { PageWithheld as Reason } from '@plitzi/sdk-shared/schema';
import type { CSSProperties } from 'react';

export type PageWithheldProps = { reason: Reason };

const WORDS: Record<Reason, { title: string; text: string }> = {
  unauthenticated: {
    title: 'Sign in to see this page',
    text: 'This page is for people who are signed in and have access to it.'
  },
  forbidden: {
    title: 'This page is not available to you',
    text: 'It is for people with access you do not have. If you think you should, ask whoever runs this site.'
  }
};

// The page's own type and ink, whatever the space calls them: a fallback for a space that declares none.
const BOX: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxWidth: '560px',
  margin: '64px auto',
  padding: '0 16px',
  textAlign: 'center',
  color: 'var(--foreground, inherit)'
};

const TITLE: CSSProperties = { margin: 0, fontSize: '24px', lineHeight: 1.25 };

const TEXT: CSSProperties = { margin: 0, color: 'var(--muted, inherit)', fontSize: '16px', lineHeight: 1.55 };

/**
 * What a page the server withheld from this visitor shows instead of its content — which was never sent: why, in a
 * sentence, inside the page's own layout so the site around it still works. The server answers it with 401 or 403.
 */
const PageWithheld = ({ reason }: PageWithheldProps) => (
  <section className="plitzi-component__page-withheld" style={BOX} data-withheld={reason}>
    <h1 style={TITLE}>{WORDS[reason].title}</h1>
    <p style={TEXT}>{WORDS[reason].text}</p>
  </section>
);

export default PageWithheld;
