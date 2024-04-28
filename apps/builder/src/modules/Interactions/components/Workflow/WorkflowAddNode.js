// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

/**
 * @param {{
 *   className?: string;
 *   topOpened?: boolean;
 *   bottomOpened?: boolean;
 *   concatenateTop?: boolean;
 *   concatenateBottom?: boolean;
 *   id?: string;
 *   onClick?: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const WorkflowAddNode = props => {
  const {
    className = '',
    topOpened = false,
    bottomOpened = false,
    concatenateTop = false,
    concatenateBottom = false,
    id = '',
    onClick = noop
  } = props;

  const handleClick = useCallback(() => onClick(id), [id, onClick]);

  return (
    <div
      className={classNames('flex items-center justify-center w-full', className, {
        'mb-[-14px] z-10': concatenateBottom
      })}
    >
      <div className="group flex flex-col items-center justify-center">
        {concatenateTop && (
          <div
            className={classNames('w-0.5 h-4', {
              'bg-blue-500': topOpened,
              'bg-gray-300': !topOpened
            })}
          />
        )}
        <div
          className={classNames(
            'relative flex flex-col items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-500 bg-white rounded-full aspect-square cursor-pointer',
            {
              'text-blue-500': topOpened || bottomOpened,
              'text-gray-300': !topOpened && !bottomOpened
            }
          )}
          onClick={handleClick}
        >
          <i className="fa-solid fa-plus h-7 w-7 flex items-center justify-center absolute translate-x-[-50%] translate-y-[-50%] top-1/2 left-1/2" />
          <div
            className={classNames('h-3.5 w-7 border-2 rounded-t-full border-b-0 group-hover:border-blue-500', {
              'border-blue-500': topOpened,
              'border-gray-300': !topOpened
            })}
          />
          <div
            className={classNames('h-3.5 w-7 border-2 rounded-b-full border-t-0 group-hover:border-blue-500', {
              'border-blue-500': bottomOpened,
              'border-gray-300': !bottomOpened
            })}
          />
        </div>
        {/* {concatenateBottom && <div className="bg-gray-700 group-hover:bg-gray-500 w-1 h-4" />} */}
      </div>
    </div>
  );
};

export default WorkflowAddNode;
