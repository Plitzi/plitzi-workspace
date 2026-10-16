/**
 * What an interaction is checked against, without the React that runs it: the global callbacks each source declares and
 * the utilities' parameter specs.
 *
 * They live beside their sources and are gathered here so they can be read outside a browser — the authoring linter, a
 * seed, a script — where a source's barrel would bring its component along.
 */

export { actionsCallbacks } from '../sources/ActionsSource/callbacks';
export { authCallbacks } from '../sources/AuthSource/callbacks';
export { hostCallbacks } from '../sources/HostSource/callbacks';
export { navigationCallbacks } from '../sources/NavigationSource/callbacks';
export { queriesCallbacks } from '../sources/QueriesSource/callbacks';
export { stateCallbacks } from '../sources/StateSource/callbacks';
export { copyToClipboardSpec } from '../utility/copyToClipboardSpec';
export { webHookSpec } from '../utility/webHookSpec';
