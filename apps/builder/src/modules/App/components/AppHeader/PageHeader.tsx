import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback, use } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';

const PageHeader = () => {
  const { pageDefinitions } = use(SchemaMainContext);
  const { currentPageId } = use(NavigationContext);
  const [, setPopupsActiveLeft] = useStorage<string[]>('builder-state.popupSidePanel.popupsActive.left', []);

  const handleClick = useCallback(() => {
    setPopupsActiveLeft(state => (!state.includes('pages') ? [...state, 'pages'] : state.filter(p => p !== 'pages')));
  }, [setPopupsActiveLeft]);

  const pageLabel = get(pageDefinitions, `${currentPageId}.attributes.name`, '') as string;
  const isHome = get(pageDefinitions, `${currentPageId}.attributes.default`, false) as boolean;

  return (
    <div
      className="flex w-31.5 min-w-0 grow basis-0 cursor-pointer items-center gap-1 text-xs select-none"
      title={pageLabel}
      onClick={handleClick}
    >
      {!isHome && <i className="fa-solid fa-file" />}
      {isHome && <i className="fas fa-home" />}
      <span className="truncate font-bold">{pageLabel}</span>
    </div>
  );
};

export default PageHeader;
