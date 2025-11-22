import clsx from 'clsx';

import type { StyleValue } from '@plitzi/sdk-shared';

export type SpacingNumberProps = {
  value?: StyleValue;
  active?: boolean;
  onClick?: () => void;
};

const SpacingNumber = ({ value = '', active = false, onClick }: SpacingNumberProps) => {
  return (
    <div
      className={clsx('mx-0.5 flex w-[30px] items-center justify-center rounded-md border px-0.5 text-xs', {
        'border-transparent hover:border-blue-300 hover:bg-blue-100 hover:text-blue-400': !active,
        'border-blue-300 bg-blue-100 text-blue-400': active
      })}
      title={value as string}
      onClick={onClick}
    >
      <div className="truncate">{(value as string).replace('px', '')}</div>
    </div>
  );
};

export default SpacingNumber;
