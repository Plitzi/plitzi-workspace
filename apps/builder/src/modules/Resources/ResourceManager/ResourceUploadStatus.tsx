export type ResourceUploadStatusProps = {
  processing?: boolean;
  progressUpload?: number;
  isUploaded?: boolean;
  onUpload?: () => void;
  onCancel?: () => void;
};

const ResourceUploadStatus = ({
  processing = false,
  progressUpload = 0,
  isUploaded = false,
  onUpload,
  onCancel
}: ResourceUploadStatusProps) => {
  if (isUploaded || processing) {
    return (
      <div className="group absolute top-0 right-0 bottom-0 left-0 flex cursor-pointer items-center justify-center rounded-md bg-[#00000080] text-white">
        {!processing && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-[#00000040] p-1 text-xs font-bold group-hover:hidden">
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
    <div className="group absolute top-0 right-0 bottom-0 left-0 flex cursor-pointer items-center justify-around rounded-md bg-[#00000080] text-white">
      <div className="flex h-12 w-12 items-center justify-center" title="Upload">
        <i className="fa-solid fa-cloud-arrow-up fa-3x hover:text-blue-400" onClick={onUpload} />
      </div>
      <div className="flex h-12 w-12 items-center justify-center" title="Cancel">
        <i className="fa-solid fa-circle-xmark fa-3x hover:text-red-400" onClick={onCancel} />
      </div>
    </div>
  );
};

export default ResourceUploadStatus;
