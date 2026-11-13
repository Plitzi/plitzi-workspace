import clsx from 'clsx';
import { useCallback } from 'react';

export type WorkflowAddNodeProps = {
  topOpened?: boolean;
  bottomOpened?: boolean;
  concatenateTop?: boolean;
  concatenateBottom?: boolean;
  id?: string;
  onClick?: (id: string) => void;
};

const WorkflowAddNode = ({
  topOpened = false,
  bottomOpened = false,
  concatenateTop = false,
  concatenateBottom = false,
  id = '',
  onClick
}: WorkflowAddNodeProps) => {
  const handleClick = useCallback(() => onClick?.(id), [id, onClick]);

  return (
    <div
      className={clsx('flex w-full items-center justify-center', {
        'z-10 -mb-3.5': concatenateBottom
      })}
    >
      <div className="group flex flex-col items-center justify-center">
        {concatenateTop && (
          <div
            className={clsx('h-4 w-0.5', {
              'bg-blue-500': topOpened,
              'bg-ui-line-strong': !topOpened
            })}
          />
        )}
        <div
          className={clsx(
            'bg-ui-raised relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-full group-hover:bg-blue-100 group-hover:text-blue-500 dark:group-hover:bg-blue-900/50',
            {
              'text-blue-500': topOpened || bottomOpened,
              'text-ui-fg-subtle': !topOpened && !bottomOpened
            }
          )}
          onClick={handleClick}
        >
          <i className="fa-solid fa-plus absolute top-1/2 left-1/2 flex h-7 w-7 translate-x-[-50%] translate-y-[-50%] items-center justify-center" />
          <div
            className={clsx('h-3.5 w-7 rounded-t-full border-2 border-b-0! group-hover:border-blue-500', {
              'border-blue-500': topOpened,
              'border-ui-line-strong': !topOpened
            })}
          />
          <div
            className={clsx('h-3.5 w-7 rounded-b-full border-2 border-t-0! group-hover:border-blue-500', {
              'border-blue-500': bottomOpened,
              'border-ui-line-strong': !bottomOpened
            })}
          />
        </div>
        {/* {concatenateBottom && <div className="bg-gray-700 group-hover:bg-ui-hover w-1 h-4" />} */}
      </div>
    </div>
  );
};

export default WorkflowAddNode;
