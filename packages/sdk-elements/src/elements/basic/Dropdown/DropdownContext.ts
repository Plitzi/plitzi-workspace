import { createContext } from 'react';

import type { FloatingPosition } from './useDropdown';
import type { MouseEvent, RefObject } from 'react';

export type DropdownContextValue = {
  popupRef: RefObject<HTMLDivElement | null>;
  openPopup: boolean;
  parameters?: FloatingPosition;
  onClick: (e: MouseEvent) => void;
};

const DropdownContext = createContext(undefined as unknown as DropdownContextValue);

export default DropdownContext;
