import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import Text from '@plitzi/plitzi-ui/Text';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { rootName, searchElements } from '../../../../helpers/searchElements';
import useRevealElement from '../../../../hooks/useRevealElement';
import ElementMatchItem from '../../../ElementMatchItem';

import type { ElementMatch } from '../../../../helpers/searchElements';
import type { KeyboardEvent } from 'react';

export type BuilderSearchPanelProps = {
  onClose: () => void;
};

/**
 * The input and its results. Mounted only while the search is open, so every opening starts from an empty query.
 */
const BuilderSearchPanel = ({ onClose }: BuilderSearchPanelProps) => {
  const [[flat, currentPageId]] = useBuilderStore(['schema.flat', 'navigation.currentPageId']);
  const revealElement = useRevealElement();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => searchElements(flat, query, { currentRootId: currentPageId }),
    [flat, query, currentPageId]
  );
  // Clamped rather than reset: the schema can change under an open search and shorten the list.
  const active = Math.min(activeIndex, matches.length - 1);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(0);
  }, []);

  const handleSelect = useCallback(
    (match: ElementMatch) => {
      revealElement(match);
      onClose();
    },
    [onClose, revealElement]
  );

  const handleHover = useCallback(
    (match?: ElementMatch) => {
      if (match) {
        setActiveIndex(matches.indexOf(match));
      }
    },
    [matches]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex(Math.min(active + 1, matches.length - 1));
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex(Math.max(active - 1, 0));
          break;
        }

        case 'Enter': {
          if (active >= 0) {
            handleSelect(matches[active]);
          }

          break;
        }

        case 'Escape': {
          // Stopped here: the canvas reads Escape on the document as "clear the selection".
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        }

        default:
      }
    },
    [active, handleSelect, matches, onClose]
  );

  const searching = query.trim() !== '';

  return (
    <Flex direction="column" className="min-h-0 w-full">
      <div className="border-b border-gray-200 p-3 dark:border-zinc-700">
        <Input
          ref={inputRef}
          placeholder="Element id, label, type or page name…"
          value={query}
          size="sm"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        >
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
      </div>
      <div className="max-h-100 min-h-0 overflow-y-auto p-1">
        {!searching && (
          <Text size="xs" className="block px-2 py-3 text-center opacity-60">
            Searches every page and layout in this space
          </Text>
        )}
        {searching && matches.length === 0 && (
          <Text size="xs" className="block px-2 py-3 text-center opacity-60">
            Nothing named like that in this space
          </Text>
        )}
        {matches.map((match, index) => (
          <ElementMatchItem
            key={match.id}
            match={match}
            rootLabel={rootName(flat, match.rootId)}
            active={index === active}
            onSelect={handleSelect}
            onHover={handleHover}
          />
        ))}
      </div>
    </Flex>
  );
};

export default BuilderSearchPanel;
