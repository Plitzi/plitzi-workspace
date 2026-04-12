import Icon from '@plitzi/plitzi-ui/Icon';
import Text from '@plitzi/plitzi-ui/Text';

import type { ReactNode } from 'react';

export type SpaceCredentialsEmptyProps = {
  children?: ReactNode;
};

const SpaceCredentialsEmpty = ({ children }: SpaceCredentialsEmptyProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded border border-dashed border-gray-300 p-10 dark:border-zinc-600">
      <div className="flex flex-col items-center justify-center gap-2">
        <Icon icon="fa-solid fa-key" size="custom" className="fa-2x rounded-full bg-gray-400 p-4" />
        <Text>No credentials yet</Text>
        <Text className="text-gray-400 dark:text-zinc-500">
          Add your first credential to start managing your credentials
        </Text>
      </div>
      {children}
    </div>
  );
};

export default SpaceCredentialsEmpty;
