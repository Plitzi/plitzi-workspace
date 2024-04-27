// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';

// Alias
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

/**
 * @param {{
 *   className?: string;
 *   preview?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const TransformPreview = props => {
  const { className = '', preview } = props;
  const schemaMemo = useMemo(() => ({ schema: preview?.schema }), [preview?.schema]);
  const styleMemo = useMemo(() => ({ style: preview?.style }), [preview?.style]);

  return (
    <div className={classNames('flex grow overflow-y-auto w-full', className)}>
      <SchemaContext.Provider value={schemaMemo}>
        <StyleContext.Provider value={styleMemo}>
          <BuilderAreaPreview
            previewMode
            className="min-h-full w-full"
            schema={schemaMemo?.schema}
            id={preview?.definition?.rootId}
            styleCache={styleMemo?.style?.cache}
          />
        </StyleContext.Provider>
      </SchemaContext.Provider>
    </div>
  );
};

export default TransformPreview;
