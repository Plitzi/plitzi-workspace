import Heading from '@plitzi/plitzi-ui/Heading';

import type { ReactNode } from 'react';

export type ConnectorSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

const ConnectorSection = ({ title, description, children }: ConnectorSectionProps) => {
  return (
    <div className="flex flex-col gap-2 border-t border-gray-200 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-700">
      <div className="flex flex-col">
        <Heading as="h6">{title}</Heading>
        {description && <span className="text-xs text-gray-500 dark:text-zinc-400">{description}</span>}
      </div>
      {children}
    </div>
  );
};

export default ConnectorSection;
