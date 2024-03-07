// Packages
import React, { useCallback, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import get from 'lodash/get';
import { Link } from 'react-router-dom';
import ContainerAutoScale from '@plitzi/plitzi-ui-components/ContainerAutoScale';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';

// Alias
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview/BuilderAreaPreview';

// Relatives
import PageActions from './PageActions';

const Page = props => {
  const { className = '', id = '', active = false, nestedLevel = 0 } = props;
  const {
    schema,
    schema: { flat }
  } = useContext(SchemaContext);
  const {
    style: { cache }
  } = useContext(StyleContext);
  const [zoom, setZoom] = useState(false);
  const page = useMemo(() => get(flat, id, {}), [flat, id]);
  if (!page) {
    return undefined;
  }

  const {
    attributes: { name, default: defaultPage },
    definition: { label, type }
  } = page;

  const handleClickZoom = useCallback(e => {
    e.stopPropagation();
    e.preventDefault();
    setZoom(state => !state);
  }, []);

  return (
    <div className="group not-last:border-b border-gray-300 flex">
      <Link to={id} className="flex flex-col basis-0 min-w-0 grow">
        <div className={classNames('flex px-2 py-1 min-w-0 basis-0 grow items-center justify-between', className)}>
          <div className="flex min-w-0 basis-0 grow items-center" style={{ paddingLeft: nestedLevel * 16 }}>
            <i className="fa-solid fa-file mr-2" />
            <div className={classNames('truncate min-w-0 grow', { 'text-blue-300': active })}>
              {name ?? label ?? type}
            </div>
          </div>
          <PageActions id={id} active={active} zoom={zoom} defaultPage={defaultPage} onZoom={handleClickZoom} />
        </div>
        {zoom && (
          <div className="border border-gray-300 p-4 m-4 rounded">
            <ContainerAutoScale className="flex items-center justify-center h-[150px] w-full overflow-hidden rounded">
              <BuilderAreaPreview id={id} schema={schema} styleCache={cache} className="w-full h-full" />
            </ContainerAutoScale>
          </div>
        )}
      </Link>
    </div>
  );
};

Page.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  active: PropTypes.bool,
  nestedLevel: PropTypes.number
};

export default Page;
