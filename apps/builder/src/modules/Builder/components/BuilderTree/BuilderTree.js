// Packages
import React, { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import noop from 'lodash/noop';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Relatives
import BuilderSelectedContext from '../../contexts/BuilderSelectedContext';
import BuilderContext from '../../BuilderContext';
import BuilderHoveredContext from '../../contexts/BuilderHoveredContext';
import BuilderTreeNode from './BuilderTreeNode';
import { isInViewport } from '../../../../helpers/utils';
import BuilderSchemaContext from '../../contexts/BuilderSchemaContext';

const BuilderTree = props => {
  const { setDragTree = noop } = props;
  const [, setCache, getCache] = useCache();
  const openedCache = getCache('BuilderTree.openedCache', {});
  const dragMetadata = useRef({
    isDragging: false,
    element: null,
    elementParent: null,
    elementHoveredId: null,
    dropPosition: null
  });
  const {
    baseContext: { baseElementId }
  } = useContext(BuilderContext);
  const { elementHovered, setHovered: setHoverElement } = useContext(BuilderHoveredContext);
  const { elementSelected, setSelected: setSelectElement } = useContext(BuilderSelectedContext);

  const {
    schema: { flat }
  } = useContext(BuilderSchemaContext);
  const baseElement = useMemo(() => flat[baseElementId], [flat, baseElementId]);

  const handleHover = useCallback(nodeId => setHoverElement(nodeId), [flat, setHoverElement]);

  const handleSelect = useCallback(nodeId => setSelectElement(nodeId), [flat]);

  const setOpened = useCallback((nodeId, opened) => setCache(opened, `BuilderTree.openedCache.${nodeId}`), [setCache]);

  const generateNodeMap = flat => {
    const map = {};
    Object.values(flat).forEach(element => {
      const {
        id,
        definition: { parentId }
      } = element;
      map[id] = { id, parentId };
    });

    return map;
  };

  const setOpenedMultiple = (elementId, flat) => {
    const nodeMap = generateNodeMap(flat);
    if (!nodeMap[elementId]) {
      return;
    }

    let { parentId } = nodeMap[elementId];
    if (!parentId) {
      return;
    }

    const nodesToOpen = {};
    while (parentId) {
      if (!getOpened(parentId)) {
        nodesToOpen[parentId] = true;
      }

      if (!nodeMap[parentId]) {
        parentId = null;
      } else {
        ({ parentId } = nodeMap[parentId]);
      }
    }

    if (Object.keys(nodesToOpen).length === 0) {
      const elementDOM = window.document.querySelector(`[data-tree-id="${elementId}"]`);
      if (elementDOM && !isInViewport(elementDOM)) {
        const { offsetParent, offsetTop } = elementDOM;
        offsetParent.scrollTop = offsetTop;
      }

      return;
    }

    setCache({ ...openedCache, ...nodesToOpen }, 'BuilderTree.openedCache');
    const elementDOM = window.document.querySelector(`[data-tree-id="${elementId}"]`);
    if (elementDOM && !isInViewport(elementDOM)) {
      const { offsetParent, offsetTop } = elementDOM;
      offsetParent.scrollTop = offsetTop;
    }
  };

  useEffect(() => {
    if (elementSelected) {
      setOpenedMultiple(elementSelected, flat);
    }
  }, [elementSelected]);

  const getOpened = nodeId => get(openedCache, nodeId, false);

  const setDragMetadata = useCallback((metadata, append = true) => {
    if (append) {
      dragMetadata.current = { ...dragMetadata.current, ...metadata };

      return;
    }

    dragMetadata.current = metadata;
  }, []);

  const resetDragMetadata = useCallback(() => {
    dragMetadata.current = {
      isDragging: false,
      element: null,
      elementParent: null,
      elementHoveredId: null,
      dropPosition: null
    };
  }, []);

  const getDragMetadata = useCallback(() => dragMetadata.current, []);

  const handleDragOver = () => setDragTree(true);

  const nodes = useMemo(() => {
    const recursiveMap = (element, parent = null, level = 0) => {
      if (!element) {
        return [];
      }

      const {
        definition: { items },
        id
      } = element;

      if (!items || items.length === 0) {
        return [{ id, level, isParent: false, parent }];
      }

      let elements = [{ id, level, isParent: true, parent }];
      if (!get(openedCache, id, false)) {
        return elements;
      }

      items.forEach(item => {
        elements = [...elements, ...recursiveMap(flat[item], { id, level }, level + 1)];
      });

      return elements;
    };

    if (!baseElement) {
      return [];
    }

    return recursiveMap(baseElement);
  }, [flat, baseElement, openedCache]);

  return (
    <div
      className="builder__tree h-full relative grow basis-0 user-select-none overflow-auto group"
      onDragOver={handleDragOver}
    >
      {nodes.map((node, i) => {
        const { id, level, isParent } = node;
        const isOpen = get(openedCache, id, false);

        return (
          <BuilderTreeNode
            className={i === 0 ? 'pl-1' : ''}
            key={id}
            id={id}
            level={level}
            isOpen={isOpen}
            isParent={isParent}
            setOpened={setOpened}
            elementHovered={elementHovered === id}
            setHovered={handleHover}
            elementSelected={elementSelected === id}
            setSelected={handleSelect}
            setDragMetadata={setDragMetadata}
            resetDragMetadata={resetDragMetadata}
            getDragMetadata={getDragMetadata}
          />
        );
      })}
    </div>
  );
};

BuilderTree.propTypes = {
  setDragTree: PropTypes.func
};

export default BuilderTree;
