import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useMemo, useState } from 'react';

import useFontCatalog from '../../hooks/useFontCatalog';

import type { FontCatalogEntry } from '../../hooks/useFontCatalog';
import type { SpaceFont } from '@plitzi/sdk-shared';

export type AddGoogleFontProps = {
  declared: string[];
  onAdd: (font: SpaceFont) => void;
};

/** A serif family should fall back to a serif. Google's own category is the only thing that knows which it is. */
const FALLBACK_BY_CATEGORY: Record<string, string> = {
  serif: 'Georgia, serif',
  'sans-serif': 'system-ui, sans-serif',
  display: 'system-ui, sans-serif',
  handwriting: 'cursive',
  monospace: 'ui-monospace, monospace'
};

/**
 * Weights are chosen, never assumed.
 *
 * Every weight is a file the visitor downloads, and a family offering nine of them is nine requests if the whole
 * row is taken. These two are what a page actually uses — body text and its headings — and the rest are one click
 * away in the row that opens.
 */
const COMMON_WEIGHTS = [400, 700];

const AddGoogleFont = ({ declared, onAdd }: AddGoogleFontProps) => {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string>();
  const [selectedWeights, setSelectedWeights] = useState<number[]>(COMMON_WEIGHTS);
  const [withItalic, setWithItalic] = useState(false);
  const { fonts, loading, unavailable, error } = useFontCatalog(query, true);

  const declaredSet = useMemo(() => new Set(declared), [declared]);

  const handleExpand = useCallback((entry: FontCatalogEntry) => {
    setExpanded(state => (state === entry.family ? undefined : entry.family));
    setSelectedWeights(entry.weights.filter(weight => COMMON_WEIGHTS.includes(weight)));
    setWithItalic(false);
  }, []);

  const handleToggleWeight = useCallback((weight: number) => {
    setSelectedWeights(state =>
      state.includes(weight) ? state.filter(item => item !== weight) : [...state, weight].sort((a, b) => a - b)
    );
  }, []);

  const handleAdd = useCallback(
    (entry: FontCatalogEntry) => {
      onAdd({
        source: 'google',
        family: entry.family,
        fallback: FALLBACK_BY_CATEGORY[entry.category] ?? 'system-ui, sans-serif',
        weights: selectedWeights.length > 0 ? selectedWeights : [400],
        styles: withItalic ? ['normal', 'italic'] : ['normal'],
        display: 'swap',
        subsets: entry.subsets
      });
      setExpanded(undefined);
    },
    [onAdd, selectedWeights, withItalic]
  );

  if (unavailable) {
    return (
      <Alert intent="warning" className="text-xs">
        This server has no Google Fonts API key, so it cannot list what families exist. Add one with
        <b> GOOGLE_FONTS_API_KEY</b>, or declare a family by hand under <b>External</b>.
      </Alert>
    );
  }

  return (
    <Flex direction="column" gap={2} className="min-h-0 grow basis-0">
      <Input size="xs" placeholder="Search Google Fonts" value={query} onChange={setQuery}>
        <Input.Icon icon="fa-solid fa-magnifying-glass" />
      </Input>
      {error && (
        <Alert intent="error" className="text-xs">
          {error}
        </Alert>
      )}
      <Flex direction="column" gap={1} className="min-h-0 grow basis-0 overflow-y-auto">
        {loading && fonts.length === 0 && <span className="text-grayviolet-500 text-xs">Searching…</span>}
        {fonts.map(entry => (
          <Flex key={entry.family} direction="column" gap={1} className="border-grayviolet-200 rounded border p-2">
            <Flex justify="between" alignItems="center" gap={2}>
              <span className="truncate text-sm">{entry.family}</span>
              {declaredSet.has(entry.family) ? (
                <span className="text-grayviolet-500 text-[10px]">Declared</span>
              ) : (
                <Button size="xs" intent="secondary" onClick={() => handleExpand(entry)}>
                  {expanded === entry.family ? 'Cancel' : 'Choose weights'}
                </Button>
              )}
            </Flex>
            {expanded === entry.family && (
              <Flex direction="column" gap={2}>
                <Flex wrap="wrap" gap={1}>
                  {entry.weights.map(weight => (
                    <Button
                      key={weight}
                      size="xs"
                      intent={selectedWeights.includes(weight) ? 'primary' : 'secondary'}
                      onClick={() => handleToggleWeight(weight)}
                    >
                      {weight}
                    </Button>
                  ))}
                  {entry.styles.includes('italic') && (
                    <Button
                      size="xs"
                      intent={withItalic ? 'primary' : 'secondary'}
                      onClick={() => setWithItalic(state => !state)}
                    >
                      Italic
                    </Button>
                  )}
                </Flex>
                <Button size="xs" onClick={() => handleAdd(entry)}>
                  Add {entry.family}
                </Button>
              </Flex>
            )}
          </Flex>
        ))}
        {!loading && fonts.length === 0 && query && (
          <span className="text-grayviolet-500 text-xs">Nothing matched “{query}”.</span>
        )}
      </Flex>
    </Flex>
  );
};

export default AddGoogleFont;
