import { useCallback, use, useEffect, useMemo, useRef, useState } from 'react';

import { BuilderContext } from '@plitzi/sdk-shared/builder/contexts';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import BuilderBreadcrumbItem from './BuilderBreadcrumbItem';

import type { Element } from '@plitzi/sdk-shared';

export type BuilderBreadcrumbProps = {
  limit?: number;
};

/** The start of a trail scrolled past, faded rather than cut: the eye reads that more of it is there. */
const FADED_START = {
  maskImage: 'linear-gradient(to right, transparent, black 3rem)',
  WebkitMaskImage: 'linear-gradient(to right, transparent, black 3rem)'
};

const BuilderBreadcrumb = ({ limit = Infinity }: BuilderBreadcrumbProps) => {
  const [[flat, elementHovered, setHovered, elementSelected, setSelected]] = useBuilderStore([
    'schema.flat',
    'elementHovered',
    'setHovered',
    'elementSelected',
    'setSelected'
  ]);
  const ref = useRef<HTMLUListElement>(null);
  // The trail is read from its end — the element selected — and what it scrolled past is faded in at the left, not cut.
  const [cut, setCut] = useState(false);
  const { builderElementPermissions, baseElementIdOriginal } = use(BuilderContext);

  const getPath = (id?: string): { id: string; label: string; type: string }[] => {
    if (!id) {
      return [];
    }

    const element = flat[id] as Element | undefined;
    if (!element) {
      return [{ id, label: 'unknown', type: 'unknown' }];
    }

    const {
      definition: { parentId, label, type }
    } = element;

    if (!parentId) {
      return [{ id, label, type }];
    }

    return [...getPath(parentId), { id, label, type }];
  };

  const handleClick = useCallback(
    (id: string) => {
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

  const handleMouseEnter = useCallback((id: string) => setHovered(id), [setHovered]);

  const handleMouseLeave = () => setHovered(undefined);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const path = useMemo(() => getPath(elementSelected), [elementSelected, flat]);
  const subPath = useMemo(() => {
    if (limit !== Infinity && path.length > limit) {
      return path.slice(path.length - limit);
    }

    return path;
  }, [path, limit]);

  useEffect(() => {
    if (ref.current) {
      const {
        current: { scrollWidth, offsetWidth }
      } = ref;

      ref.current.scrollLeft = scrollWidth - offsetWidth;
      setCut(scrollWidth > offsetWidth);
    }
  }, [subPath]);

  return (
    <ul
      ref={ref}
      tabIndex={-1}
      className="builder__breadcrumb flex gap-2 overflow-x-auto px-2"
      style={cut ? FADED_START : undefined}
      onMouseLeave={handleMouseLeave}
    >
      {subPath.length < path.length && (
        <BuilderBreadcrumbItem onMouseEnter={handleMouseEnter}>
          <i className="fas fa-ellipsis-h" />
        </BuilderBreadcrumbItem>
      )}
      {subPath.length > 0 &&
        subPath.map(segment => {
          const { id, label, type } = segment;

          return (
            <BuilderBreadcrumbItem
              key={id}
              id={id}
              isActive={id === elementSelected || id === elementHovered}
              onMouseEnter={handleMouseEnter}
              onClick={handleClick}
              label={label}
              type={type}
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
    </ul>
  );
};

export default BuilderBreadcrumb;
