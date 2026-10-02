import EmptyState from '@pmodules/App/components/EmptyState';

import type { ReactNode } from 'react';

export type SpaceCredentialsEmptyProps = {
  children?: ReactNode;
};

const SpaceCredentialsEmpty = ({ children }: SpaceCredentialsEmptyProps) => (
  <EmptyState
    icon="fa-solid fa-key"
    title="No credentials yet"
    description="Add the first one: it is encrypted at rest and only ever resolved on the server."
    action={children}
  />
);

export default SpaceCredentialsEmpty;
