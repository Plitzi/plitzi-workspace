/**
 * Whether the page is shown as a guest while a journey plays: until the session changes from the one the editor had
 * when the play began — the journey's own account (`as`), or a session it signs in to, is then what it reads.
 */
export const playsAsGuest = (playing: boolean, token: string | undefined, startedWith: string | undefined): boolean =>
  playing && token === startedWith;
