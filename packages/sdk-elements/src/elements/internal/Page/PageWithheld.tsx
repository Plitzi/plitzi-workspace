import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { withheldPageOf } from '@plitzi/sdk-shared/schema';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import useInternalItems from '../../../Element/hooks/useInternalItems';

import type { Element } from '@plitzi/sdk-shared';
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

type DrawnInsteadProps = { page: Element; previewMode?: boolean };

/** The elements of the page the space draws instead, rendered the way any page's items are. */
const DrawnInstead = ({ page, previewMode }: DrawnInsteadProps) =>
  useInternalItems({ id: page.id, definition: page.definition, children: undefined, previewMode });

/**
 * What a page the server withheld from this visitor shows instead of its content — which was never sent — inside the
 * page's own layout so the site around it still works; the server answers it with 401 or 403. The page the space names
 * for it (`settings.withheldPage`), or else why, in a sentence.
 */
const PageWithheld = ({ reason }: PageWithheldProps) => {
  const [[flat, pages, settings]] = useCommonStore(['schema.flat', 'schema.pages', 'schema.settings']);
  const {
    settings: { previewMode }
  } = usePlitzi();
  const instead = withheldPageOf({ flat, pages, settings });
  if (instead !== undefined) {
    return <DrawnInstead page={flat[instead]} previewMode={previewMode} />;
  }

  return (
    <section className="plitzi-component__page-withheld" style={BOX} data-withheld={reason}>
      <h1 style={TITLE}>{WORDS[reason].title}</h1>
      <p style={TEXT}>{WORDS[reason].text}</p>
    </section>
  );
};

export default PageWithheld;
