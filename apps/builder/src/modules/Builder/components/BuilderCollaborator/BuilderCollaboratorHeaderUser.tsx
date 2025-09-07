import type { RefObject } from 'react';

export type BuilderCollaboratorHeaderUserProps = {
  ref?: RefObject<HTMLDivElement | null>;
  color?: string;
  firstName: string;
  surName: string;
};

const BuilderCollaboratorHeaderUser = ({
  ref,
  color = '#000',
  firstName = '',
  surName = ''
}: BuilderCollaboratorHeaderUserProps) => {
  return (
    <div
      ref={ref}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 text-xs text-[9px] font-bold text-white select-none"
      style={{ borderColor: color }}
      title={`${firstName} ${surName}`}
    >
      <div
        className="m-0.5 flex h-[calc(100%-4px)] w-full items-center justify-center rounded-full bg-blue-400 uppercase"
        style={{ backgroundColor: color }}
      >
        {firstName && firstName[0]}
        {surName && surName[0]}
      </div>
    </div>
  );
};

export default BuilderCollaboratorHeaderUser;
