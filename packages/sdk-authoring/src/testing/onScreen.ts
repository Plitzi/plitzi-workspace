import type { ElementHandle, SpaceHandles } from '../schema';

export interface OnScreenOptions {
  /**
   * Which elements a freshly opened page owes: `named` (the default) is what an author bothered to name — the contract
   * a suite can hold ANY space to — and `all` adds the ones authoring numbered, for a space written for the test itself.
   */
  elements?: 'named' | 'all';
  /**
   * Ids a test knows are not on screen yet although authoring cannot tell — an element whose data has not arrived.
   * Every one must exist: a typo here would silently widen what the check lets through.
   */
  ignore?: string[];
  /**
   * The page was withheld from this visitor (its `access`, answered 401 or 403): its own elements were never sent, so
   * only its layouts' are owed — and those of the page drawn in its place, by id (`settings.withheldPage`), if any.
   */
  withheld?: { instead?: string };
}

/** The handles of a page and of every layout it renders inside, outermost shell first. */
const rootsOf = (handles: SpaceHandles, page: string, withheld?: OnScreenOptions['withheld']): ElementHandle[] => {
  const pageHandle = handles.page(page);
  const own = withheld
    ? withheld.instead === undefined
      ? {}
      : handles.page(withheld.instead).elements
    : pageHandle.elements;
  const roots: Record<string, ElementHandle>[] = [own];
  const seen = new Set<string>();
  for (let layoutId = pageHandle.layout; layoutId !== undefined && !seen.has(layoutId);) {
    // `hasOwn` rather than a truthy lookup: the record is typed as total, so a missing shell would read as present.
    if (!Object.hasOwn(handles.layouts, layoutId)) {
      break;
    }

    seen.add(layoutId);
    const layout = handles.layouts[layoutId];
    roots.unshift(layout.elements);
    layoutId = layout.layout;
  }

  return roots.flatMap(elements => Object.values(elements));
};

/** The handles a page check may owe at all: named (or every one, with `all`), drawn once, with a box, not ignored. */
const owable = (handles: SpaceHandles, page: string, options: OnScreenOptions): ElementHandle[] => {
  const ignored = new Set((options.ignore ?? []).map(id => handles.element(id).id));
  const all = options.elements === 'all';

  return rootsOf(handles, page, options.withheld).filter(
    handle => (all || handle.named) && !handle.repeated && !handle.boxless && !ignored.has(handle.id)
  );
};

/**
 * What a page shows the moment it is opened, by handle: its own elements and those of every layout it renders inside,
 * outermost shell first.
 *
 * Left out, because a bare visit cannot see them and asserting them would only fail: an element shown under a
 * condition (`conditional`), one rendered once per list row (`repeated` — several copies, or none while the list is
 * empty), and a provider with no tag (`boxless`), which has no box to be visible. The roots themselves are left out
 * too: a page and a layout are frames, and what a reader sees is what is in them.
 */
export const onScreen = (handles: SpaceHandles, page: string, options: OnScreenOptions = {}): ElementHandle[] =>
  owable(handles, page, options).filter(handle => !handle.conditional);

/**
 * What a page owes only if an element that chooses its children draws them (`shownWith`): left out of `onScreen`,
 * since a bare visit may show none, and owed like the rest once the child they come with is on screen.
 */
export const onScreenIfChosen = (handles: SpaceHandles, page: string, options: OnScreenOptions = {}): ElementHandle[] =>
  owable(handles, page, options).filter(handle => handle.shownWith !== undefined);
