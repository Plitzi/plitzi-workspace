import { use, useMemo, useState } from 'react';

import { AuthContext, guestAuth } from '@plitzi/sdk-auth';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { playsAsGuest } from './playsAsGuest';

import type { ReactNode } from 'react';

/**
 * The page under it sees none of the editor's session while a journey plays on the canvas (`playingJourney`): a guest,
 * unless the journey plays as its own account (`as`, set through the inspector) or signs in. The editor's session hid
 * every page for visitors without one, and a journey that passed on the server failed here.
 */
const GuestWhilePlaying = ({ children }: { children?: ReactNode }) => {
  const auth = use(AuthContext);
  const [playing = false] = useBuilderStore('playingJourney');
  const token = auth.user?.accessToken;
  // The session the play began with, taken as it begins: what is hidden is the editor's, never one the journey makes.
  const [was, setWas] = useState({ playing, startedWith: playing ? token : undefined });
  if (was.playing !== playing) {
    setWas({ playing, startedWith: playing ? token : undefined });
  }

  const guest = playsAsGuest(playing, token, was.startedWith);
  const value = useMemo(() => (guest ? guestAuth(auth) : auth), [guest, auth]);

  return <AuthContext value={value}>{children}</AuthContext>;
};

export default GuestWhilePlaying;
