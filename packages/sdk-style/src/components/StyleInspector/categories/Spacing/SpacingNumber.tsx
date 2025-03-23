import classNames from 'classnames';

import type { StyleValue } from '@plitzi/sdk-shared';

export type SpacingNumberProps = {
  value?: StyleValue;
  active?: boolean;
  onClick?: () => void;
};

const SpacingNumber = ({ value = '', active = false, onClick }: SpacingNumberProps) => {
  return (
    <div
      className={classNames('px-0.5 mx-0.5 border rounded-md text-xs w-[30px] flex items-center justify-center', {
        'hover:border-blue-300 hover:bg-blue-100 hover:text-blue-400 border-transparent': !active,
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
