// Packages
import React, { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';

// Relatives
import BuilderBreadcrumbItem from './BuilderBreadcrumbItem';
import BuilderSelectedContext from '../../contexts/BuilderSelectedContext';
import BuilderHoveredContext from '../../contexts/BuilderHoveredContext';
import BuilderContext from '../../BuilderContext';
import BuilderSchemaContext from '../../contexts/BuilderSchemaContext';

const BuilderBreadcrumb = props => {
  const { limit = Infinity } = props;
  const ref = useRef(null);
  const { elementSelected, setSelected } = useContext(BuilderSelectedContext);
  const { elementHovered, setHovered } = useContext(BuilderHoveredContext);
  const { builderElementPermissions, baseElementIdOriginal } = useContext(BuilderContext);
  const {
    schema: { flat }
  } = useContext(BuilderSchemaContext);

  useEffect(() => {
    if (ref.current) {
      const {
        current: { scrollWidth, offsetWidth }
      } = ref;

      ref.current.scrollLeft = scrollWidth - offsetWidth;
    }
  }, [ref.current]);

  const getPath = id => {
    if (!id) {
      return [];
    }

    const element = flat[id];
    if (!element) {
      return [{ id, label }];
    }

    const {
      definition: { parentId, label }
    } = element;

    if (!parentId) {
      return [{ id, label }];
    }

    return [...getPath(parentId), { id, label }];
  };

  const handleClick = useCallback(
    id => {
      if (!id) {
        return;
      }

      const element = flat[id];
      const canSelect = builderElementPermissions(element, 'canSelect', true);
      if (!canSelect) {
        return;
      }

      setSelected(id);
    },
    [setSelected, builderElementPermissions, flat]
  );

  const handleMouseEnter = useCallback(id => setHovered(id), [setHovered]);

  const handleMouseLeave = () => setHovered(null);

  const path = useMemo(() => getPath(elementSelected), [elementSelected, flat]);
  const subPath = useMemo(() => {
    if (limit !== Infinity && path.length > limit) {
      return path.slice(path.length - limit);
    }

    return path;
  }, [path, elementSelected]);

  return (
    <div
      ref={ref}
      className="builder__breadcrumb flex overflow-y-hidden border-b border-gray-300"
      onMouseLeave={handleMouseLeave}
    >
      {subPath.length < path.length && (
        <BuilderBreadcrumbItem
          className="hover:bg-blue-400 hover:text-white after:border-l-white hover:after:border-l-blue-400 before:border-gray-300"
          onMouseEnter={handleMouseEnter}
        >
          <i className="fas fa-ellipsis-h" />
        </BuilderBreadcrumbItem>
      )}
      {subPath.length > 0 &&
        subPath.map(segment => {
          const { id, label } = segment;

          return (
            <BuilderBreadcrumbItem
              key={id}
              id={id}
              isActive={id === elementSelected || id === elementHovered}
              onMouseEnter={handleMouseEnter}
              onClick={handleClick}
              label={label}
            />
          );
        })}
      {subPath.length === 0 && (
        <BuilderBreadcrumbItem
          key={baseElementIdOriginal}
          id={baseElementIdOriginal}
          isActive={baseElementIdOriginal === elementSelected || baseElementIdOriginal === elementHovered}
          onMouseEnter={handleMouseEnter}
          onClick={handleClick}
          label="Page"
        />
      )}
    </div>
  );
};

BuilderBreadcrumb.propTypes = {
  limit: PropTypes.number
};

export default BuilderBreadcrumb;
