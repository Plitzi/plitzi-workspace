import { createContext } from 'react';

import type { FloatingPosition } from './useDropdown';
import type { MouseEvent, RefObject } from 'react';

export type DropdownContextValue = {
  popupRef: RefObject<HTMLDivElement | null>;
  openPopup: boolean;
  parameters?: FloatingPosition;
  onClick: (e: MouseEvent) => void;
  /** Where the open popup is drawn instead of in place: the space's root, once the menu has opened (see `Dropdown`). */
  layer: HTMLElement | null;
};

// No default: its parts are drawn only inside a dropdown, and a default would hide one that is not.
const DropdownContext = createContext(undefined as unknown as DropdownContextValue);
DropdownContext.displayName = 'DropdownContext';

export default DropdownContext;
