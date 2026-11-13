import type { DocumentScroll } from './declaration';

/**
 * What each section of a page's settings says on its header, and the one line of help under its fields — of the state
 * it is in, never of every state it could be in: a page's form wrote a notice under each field, and grew longer than
 * the panel showed.
 */

export type AccessSettings = {
  accessLevel: 'public' | 'authenticated' | '';
  permissions: string[];
  unauthorizedBehaviour: '' | 'redirect' | 'notFound';
  /** The page a refused visitor is sent to, by name, when one is chosen. */
  redirectName: string;
};

/** Who a page is for, and what anybody else gets: `Signed-in visitors · 404 to others`. */
export const accessSummary = ({
  accessLevel,
  permissions,
  unauthorizedBehaviour,
  redirectName
}: AccessSettings): string => {
  const who =
    permissions.length > 0
      ? `Needs ${permissions.join(', ')}`
      : accessLevel === 'authenticated'
        ? 'Signed-in visitors'
        : accessLevel === 'public'
          ? 'Signed-out visitors only'
          : 'Anyone';
  if (who === 'Anyone') {
    return who;
  }

  const others =
    unauthorizedBehaviour === 'notFound'
      ? ' · 404 to others'
      : unauthorizedBehaviour === 'redirect'
        ? ` · others to ${redirectName || 'a page'}`
        : '';

  return `${who}${others}`;
};

/** Whether a page is kept from anybody: what its section's header draws in the accent. */
export const isRestricted = ({
  accessLevel,
  permissions
}: Pick<AccessSettings, 'accessLevel' | 'permissions'>): boolean => accessLevel !== '' || permissions.length > 0;

/** The one line under the access fields, of the state they are in. */
export const accessHelp = ({ accessLevel, permissions, unauthorizedBehaviour }: AccessSettings): string => {
  if (!isRestricted({ accessLevel, permissions })) {
    return 'Anyone on the internet can open this page.';
  }

  if (accessLevel === 'public' && permissions.length === 0) {
    return 'Only visitors who are not signed in can open this page.';
  }

  const kept =
    permissions.length > 0
      ? 'Only signed-in visitors holding every one of these permissions see this page.'
      : 'Only signed-in visitors see this page.';
  const others =
    unauthorizedBehaviour === 'notFound'
      ? ' Anybody else gets the space’s 404, and nothing of it — not its name nor its path: for a back-office, whose refusal would tell a prober something is there.'
      : unauthorizedBehaviour === 'redirect'
        ? ' Anybody else is sent to the redirect page.'
        : ' Anybody else is answered 401 or 403, and the server never sends them its content.';

  return `${kept}${others}`;
};

const SCROLLS: Record<DocumentScroll | '', { label: string; help: string }> = {
  '': { label: 'Scrolls', help: 'The page scrolls as any page does.' },
  noBounce: {
    label: 'No bounce',
    help: 'The page scrolls, but a finger pulled past either end no longer bounces it or reloads it.'
  },
  locked: {
    label: 'Locked',
    help: 'The page holds still: only the parts set to scroll on their own (overflow auto) move. For a screen that fills the window — a dashboard, a board.'
  }
};

/** How the page scrolls, in a word, and what that means. */
export const scrollOf = (documentScroll: DocumentScroll | ''): { label: string; help: string } =>
  SCROLLS[documentScroll];

/** What the search and sharing section holds: off, or the title a search result shows. */
export const seoSummary = (seoEnabled: boolean, title: string): string => (seoEnabled ? title || 'On' : 'Off');
