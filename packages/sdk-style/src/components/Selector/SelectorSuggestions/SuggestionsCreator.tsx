import SelectorItem from '../SelectorItem';

import type { SelectorValue } from '../Selector';

export type SuggestionsCreatorProps = {
  selector?: string;
  onClick?: (selector: SelectorValue) => void;
};

const SuggestionsCreator = ({ selector, onClick }: SuggestionsCreatorProps) => {
  return (
    <div className="flex flex-col">
      <div className="text-sm font-bold">New Token</div>
      <div className="flex items-center gap-1 px-2 text-xs">
        <div>Create:</div>
        <SelectorItem selector={selector} editable={false} active onClick={onClick} />
      </div>
    </div>
  );
};

export default SuggestionsCreator;
