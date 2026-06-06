import { createStoreHook } from '@plitzi/nexus';

export type Profile = {
  name: string;
  role: string;
  bio: string;
};

export type DraftState = {
  profile: Profile;
};

export const DRAFT_INITIAL: DraftState = {
  profile: {
    name: 'Ada Lovelace',
    role: 'Mathematician',
    bio: 'Wrote the first published algorithm intended for a machine.'
  }
};

export const {
  useStore: useDraft,
  useStoreGetter: useDraftGetter,
  useStoreSetter: useDraftSetter
} = createStoreHook<DraftState>();
