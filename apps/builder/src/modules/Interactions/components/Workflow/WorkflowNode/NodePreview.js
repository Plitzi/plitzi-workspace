// Packages
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';
import CodeMirror from '@plitzi/plitzi-ui-components/CodeMirror';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

/**
 * @param {{
 *   className?: string;
 *   preview?: object;
 *   defaultPreview?: object;
 *   onChange?: (data: object) => void;
 *   onClickOpen?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const NodePreview = props => {
  const { className = '', preview = emptyObject, defaultPreview = emptyObject, onChange = noop } = props;
  const previewStr = useMemo(() => JSON.stringify(preview, null, 2), [preview]);
  const defaultPreviewStr = useMemo(() => JSON.stringify(defaultPreview, null, 2), [defaultPreview]);
  const [previewState, setPreviewState] = useState(previewStr);
  const [error, setError] = useState('');

  const handleChange = useCallback(
    data => {
      try {
        const dataParsed = JSON.parse(data);
        if (previewStr !== data) {
          onChange({ preview: dataParsed });
        }

        setError('');
      } catch (e) {
        setError(e.message);
      } finally {
        setPreviewState(data);
      }
    },
    [previewStr, onChange]
  );

  const containerTitle = useMemo(
    () => (
      <Heading type="h5" className="w-full">
        Preview
      </Heading>
    ),
    []
  );

  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      if ((!preview || Object.keys(preview).length === 0) && defaultPreview && Object.keys(defaultPreview).length > 0) {
        onChange({ preview: defaultPreview });
      }

      return;
    }

    if (previewStr !== defaultPreviewStr) {
      onChange({ preview: defaultPreview });
    }
  }, [defaultPreview]);

  useEffect(() => {
    if (previewStr !== previewState) {
      setPreviewState(previewStr);
    }
  }, [previewStr]);

  const isCollapsed = useMemo(
    () => !preview || Object.keys(preview).length === 0 || previewStr === defaultPreviewStr,
    [preview]
  );

  return (
    <div
      className={classNames('flex flex-col py-2 px-4 items-center border-t-2 border-gray-300 border-dotted', className)}
    >
      <ContainerCollapsable className="w-full flex justify-center" title={containerTitle} collapsed={isCollapsed}>
        <CodeMirror
          className="min-h-[80px] pt-2"
          value={previewState}
          theme="light"
          mode="json"
          lineWrapping
          onChange={handleChange}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </ContainerCollapsable>
    </div>
  );
};

export default NodePreview;
