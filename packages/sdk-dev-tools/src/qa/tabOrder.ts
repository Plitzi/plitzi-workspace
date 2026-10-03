import { INTERACTIVE, isDrawn } from './checks/dom';

/** The order the Tab key walks the page's controls in: positive `tabindex` first, by value, then the page's order. */
export const tabOrderOf = (page: Element): Element[] => {
  const candidates = [...page.querySelectorAll(`${INTERACTIVE}, [tabindex]`)].filter(element => {
    const index = Number(element.getAttribute('tabindex') ?? 0);

    return index >= 0 && isDrawn(element) && !element.matches(':disabled');
  });
  const indexOf = (element: Element): number => Number(element.getAttribute('tabindex') ?? 0);
  const ordered = candidates.filter(element => indexOf(element) > 0).sort((a, b) => indexOf(a) - indexOf(b));

  return [...ordered, ...candidates.filter(element => indexOf(element) === 0)];
};
