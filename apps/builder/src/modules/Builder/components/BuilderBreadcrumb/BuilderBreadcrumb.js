// Packages
import React, { useCallback, use, useEffect, useMemo, useRef } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import BuilderHoveredContext from '@plitzi/sdk-shared/builder/contexts/BuilderHoveredContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';

// Relatives
import BuilderBreadcrumbItem from './BuilderBreadcrumbItem';

/**
 * @param {{
 *   limit?: number;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderBreadcrumb = props => {
  const { limit = Infinity } = props;
  const ref = useRef(null);
  const { elementSelected, setSelected } = use(BuilderSelectedContext);
  const { elementHovered, setHovered } = use(BuilderHoveredContext);
  const { builderElementPermissions, baseElementIdOriginal } = use(BuilderContext);
  const {
    schema: { flat }
  } = use(BuilderSchemaContext);

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
      tabIndex={-1}
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

export default BuilderBreadcrumb;
