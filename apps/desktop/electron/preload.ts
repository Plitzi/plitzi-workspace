import { contextBridge, ipcRenderer } from 'electron';

import { STORE_CHANNEL } from './contract';

import type { StoreRequest } from './contract';
import type { DesktopBridge } from '../src/modules/desktop/bridge';

const invoke = <T>(request: StoreRequest): Promise<T> => ipcRenderer.invoke(STORE_CHANNEL, request) as Promise<T>;

/** The writes answer with nothing; `void` is not a type an argument may be, so the result is simply dropped. */
const send = async (request: StoreRequest): Promise<void> => {
  await invoke<unknown>(request);
};

/**
 * The whole of what the renderer may reach outside its own page.
 *
 * Three calls and two facts — not `ipcRenderer`, and not a generic "invoke anything" hatch. The renderer runs a
 * web app against a remote API, so anything it can do to this machine is surface that exists only to be got wrong
 * later; what it genuinely cannot do for itself is keep a session where the operating system keeps secrets.
 */
const bridge: DesktopBridge = {
  platform: process.platform,
  version: process.env.PLITZI_DESKTOP_VERSION ?? '0.0.0',
  readSession: () => invoke<string | undefined>({ action: 'read' }),
  writeSession: value => send({ action: 'write', value }),
  clearSession: () => send({ action: 'clear' })
};

contextBridge.exposeInMainWorld('plitziDesktop', bridge);
