// Packages
import React from 'react';
import noop from 'lodash/noop';

/**
 * @param {{
 *   processing?: boolean;
 *   progressUpload?: number;
 *   isUploaded?: boolean;
 *   onUpload?: () => void;
 *   onCancel?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ResourceUploadStatus = props => {
  const { processing = false, progressUpload = 0, isUploaded = false, onUpload = noop, onCancel = noop } = props;

  if (isUploaded || processing) {
    return (
      <div className="group absolute top-0 bottom-0 left-0 right-0 bg-[#00000080] rounded-md flex items-center justify-center cursor-pointer text-white">
        {!processing && (
          <>
            <div className="group-hover:hidden w-12 h-12 flex items-center justify-center font-bold bg-[#00000040] rounded-full p-1 border-2 border-white text-xs">
              <span>{progressUpload}</span>
              <span className="text-[10px]">%</span>
            </div>
            <div className="hidden group-hover:block" title="Cancel">
              <i className="fa-solid fa-circle-xmark fa-2x hover:text-red-400" onClick={onCancel} />
            </div>
          </>
        )}
        {processing && <i className="fa-solid fa-sync fa-spin fa-2x" title="Processing" />}
      </div>
    );
  }

  return (
    <div className="group absolute top-0 bottom-0 left-0 right-0 bg-[#00000080] rounded-md flex items-center justify-around cursor-pointer text-white">
      <div className="w-12 h-12 flex items-center justify-center" title="Upload">
        <i className="fa-solid fa-cloud-arrow-up hover:text-blue-400 fa-3x" onClick={onUpload} />
      </div>
      <div className="w-12 h-12 flex items-center justify-center" title="Cancel">
        <i className="fa-solid fa-circle-xmark hover:text-red-400 fa-3x" onClick={onCancel} />
      </div>
    </div>
  );
};

export default ResourceUploadStatus;
