// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';

// Alias
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

const TransformPreview = props => {
  const { preview } = props;
  const schemaMemo = useMemo(() => ({ schema: preview?.schema }), [preview?.schema]);
  const styleMemo = useMemo(() => ({ style: preview?.style }), [preview?.style]);

  return (
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
  );
};

TransformPreview.propTypes = {
  preview: PropTypes.object
};

export default TransformPreview;
