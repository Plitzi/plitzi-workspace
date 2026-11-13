import { use, useMemo, useState } from 'react';

import { AuthContext, guestAuth } from '@plitzi/sdk-auth';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { playsAsGuest } from './playsAsGuest';

import type { ReactNode } from 'react';

/**
 * The page under it shows the visitor of the journey on the canvas (`journeyOnCanvas`, opened or played) — never the
 * editor's session: its test account (`as`, laid over the page as `runtime.testAccount`), a session it signs in to, or a
 * guest. The editor's session hid every page for visitors without one, and a journey that passed on the server failed
 * here; a journey opened as an account showed the page as the editor until it was played.
 */
const JourneyVisitor = ({ children }: { children?: ReactNode }) => {
  const auth = use(AuthContext);
  const [[onCanvas = false, testAccount, canvasGuest = false]] = useBuilderStore([
    'journeyOnCanvas',
    'runtime.testAccount',
    'canvasGuest'
  ]);
  const token = auth.user?.accessToken;
  // The editor's own session, as it stands while no journey is on the canvas: what a journey's visitor never reads.
  const [editorToken, setEditorToken] = useState(token);
  if (!onCanvas && testAccount === undefined && editorToken !== token) {
    setEditorToken(token);
  }

  // Or the State Manager shows the page to a guest — while no journey is on the canvas to decide its own visitor.
  const guest =
    playsAsGuest(onCanvas, testAccount !== undefined, token, editorToken) ||
    (!onCanvas && canvasGuest && testAccount === undefined);
  const value = useMemo(() => (guest ? guestAuth(auth) : auth), [guest, auth]);

  return <AuthContext value={value}>{children}</AuthContext>;
};

export default JourneyVisitor;
