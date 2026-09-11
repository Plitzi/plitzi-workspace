import Flex from '@plitzi/plitzi-ui/Flex';
import { get } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import Text from '@plitzi/plitzi-ui/Text';
import clsx from 'clsx';
import { use, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { rootName, searchElements } from '../helpers/searchElements';

import type { ElementLookup, ElementMatch } from '../helpers/searchElements';

export type BuilderTreeSearchProps = {
  query: string;
  baseElementId?: string;
  onQueryChange: (query: string) => void;
  /** Opens the tree down to a match before selecting it: the ids the panel has to expand, outermost first. */
  onReveal: (ancestors: string[]) => void;
};

/**
 * Finding an element by name, anywhere in the space.
 *
 * The tree can only ever show ONE page, and only the branches somebody has already opened, so the two ways an
 * element goes missing are having forty pages and having it eight levels down. This answers both from the flat
 * schema, which already holds every element of every page — the search is over the whole space, and a result names
 * the page it is on.
 *
 * Picking one opens that page if it is not the one on screen, opens the tree down to the element, and selects it.
 */
const BuilderTreeSearch = ({ query, baseElementId, onQueryChange, onReveal }: BuilderTreeSearchProps) => {
  const [[flat, setSelectElement, setHoverElement]] = useBuilderStore(['schema.flat', 'setSelected', 'setHovered']);
  const { componentDefinitions } = use(ComponentContext);
  const { eventBridge } = use(EventBridgeContext);
  const navigate = useNavigate();

  const matches = useMemo(
    () => searchElements(flat as ElementLookup, query, { currentRootId: baseElementId }),
    [flat, query, baseElementId]
  );

  const handleSelect = useCallback(
    (match: ElementMatch) => {
      const { id, rootId, ancestors } = match;
      onReveal(ancestors);

      if (rootId !== baseElementId) {
        // A page is a route in this editor and a layout is not, so opening one is not the same act as opening the
        // other — the directory makes the same split, for the same reason.
        const rootType = get(flat, `${rootId}.definition.type`, '');
        if (rootType === 'layoutContainer') {
          void eventBridge.emit('builder', 'builderSetBaseContext', rootId);
        } else {
          void navigate(`/${rootId}`);
        }
      }

      // After the switch, not before: opening a base context clears the selection on its way in, so selecting first
      // would land on the element and then lose it.
      setSelectElement(id);
    },
    [baseElementId, eventBridge, flat, navigate, onReveal, setSelectElement]
  );

  const handleChange = useCallback((value: string) => onQueryChange(value), [onQueryChange]);

  return (
    <Flex direction="column" gap={1} className="min-h-0 w-full">
      <div className="px-2 pt-2">
        <Input placeholder="Find an element…" value={query} size="sm" onChange={handleChange}>
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
      </div>
      {query.trim() !== '' && (
        <div className="min-h-0 grow basis-0 overflow-y-auto px-1 pb-2">
          {matches.length === 0 && (
            <Text size="xs" className="block px-2 py-3 text-center opacity-60">
              Nothing named like that in this space
            </Text>
          )}
          {matches.map(match => {
            const onCurrentPage = match.rootId === baseElementId;

            return (
              <button
                key={match.id}
                type="button"
                onClick={() => handleSelect(match)}
                onMouseEnter={() => onCurrentPage && setHoverElement(match.id)}
                onMouseLeave={() => onCurrentPage && setHoverElement(undefined)}
                className="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <i
                  className={clsx(
                    'w-3 shrink-0 text-center text-[10px] opacity-70',
                    get(componentDefinitions.current, `${match.type}.market.icon`, 'fa-regular fa-square')
                  )}
                />
                <span className="min-w-0 grow basis-0 truncate text-xs">
                  {match.id}
                  {match.label && <span className="opacity-50"> · {match.label}</span>}
                </span>
                {!onCurrentPage && (
                  <span className="shrink-0 truncate text-[10px] opacity-60">{rootName(flat, match.rootId)}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Flex>
  );
};

export default BuilderTreeSearch;
