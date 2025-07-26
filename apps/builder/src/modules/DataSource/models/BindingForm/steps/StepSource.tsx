import ErrorMessage from '@plitzi/plitzi-ui/ErrorMessage';
import Form from '@plitzi/plitzi-ui/Form';
import Heading from '@plitzi/plitzi-ui/Heading';
import get from 'lodash/get';

import type { SourceMeta } from '@plitzi/sdk-shared';

export type StepSourceProps = {
  sources: Record<string, SourceMeta>;
};

const StepSource = ({ sources }: StepSourceProps) => {
  return (
    <Form.Custom
      name="source"
      render={({ field: { ref, value, onChange }, fieldState: { error: fieldError } }) => (
        <div className="flex flex-col gap-2" ref={ref}>
          <Heading as="h5">Sources</Heading>
          <div className="flex flex-col">
            {Object.keys(sources).map((srcKey, i) => {
              const name = get(sources[srcKey], 'name', '');

              return (
                <div
                  key={i}
                  className="group flex w-full cursor-pointer items-center overflow-hidden rounded-sm border px-2 py-1 select-none hover:bg-blue-400 [&:not(:first-child)]:mt-2"
                  title={name}
                  onClick={() => onChange(srcKey)}
                >
                  <i className="fas fa-database text-blue-400 group-hover:text-white" />
                  <div className="w-full truncate px-1 text-xs group-hover:text-white">{name}</div>
                  {value === srcKey && (
                    <i className="fa-solid fa-check text-blue-400 group-hover:text-white" title="Selected" />
                  )}
                </div>
              );
            })}
          </div>
          {fieldError && <ErrorMessage message={fieldError.message} error={!!fieldError.message} />}
        </div>
      )}
    />
  );
};

export default StepSource;
