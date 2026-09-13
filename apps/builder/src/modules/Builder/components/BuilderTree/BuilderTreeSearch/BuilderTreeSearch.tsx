import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import Text from '@plitzi/plitzi-ui/Text';
import { useCallback, useMemo } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { rootName, searchElements } from '../../../helpers/searchElements';
import useRevealElement from '../../../hooks/useRevealElement';
import ElementMatchItem from '../../ElementMatchItem';

import type { ElementMatch } from '../../../helpers/searchElements';

export type BuilderTreeSearchProps = {
  query: string;
  baseElementId?: string;
  onQueryChange: (query: string) => void;
};

/**
 * The Layers panel's own way into the global search: the same space-wide results, inline, where the tree is.
 *
 * Picking one opens its page or layout, opens the tree down to it and selects it — then clears the query, which is
 * what puts the tree back on screen to show it. The builder-wide search (⌘P) does the same from anywhere else.
 */
const BuilderTreeSearch = ({ query, baseElementId, onQueryChange }: BuilderTreeSearchProps) => {
  const [[flat, setHoverElement]] = useBuilderStore(['schema.flat', 'setHovered']);
  const revealElement = useRevealElement();

  const matches = useMemo(
    () => searchElements(flat, query, { currentRootId: baseElementId }),
    [flat, query, baseElementId]
  );

  const handleSelect = useCallback(
    (match: ElementMatch) => {
      revealElement(match);
      onQueryChange('');
    },
    [onQueryChange, revealElement]
  );

  const handleHover = useCallback(
    (match?: ElementMatch) => {
      // Only the root on screen has an overlay to draw; a match anywhere else has nothing to point at.
      setHoverElement(match && match.rootId === baseElementId ? match.id : undefined);
    },
    [baseElementId, setHoverElement]
  );

  return (
    <Flex direction="column" gap={1} className="min-h-0 w-full">
      <div className="px-2 pt-2">
        <Input placeholder="Find an element…" value={query} size="sm" onChange={onQueryChange}>
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
          {matches.map(match => (
            <ElementMatchItem
              key={match.id}
              match={match}
              rootLabel={match.rootId === baseElementId ? undefined : rootName(flat, match.rootId)}
              onSelect={handleSelect}
              onHover={handleHover}
            />
          ))}
        </div>
      )}
    </Flex>
  );
};

export default BuilderTreeSearch;
