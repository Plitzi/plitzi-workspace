import type { BuiltinGlobalCallback } from '@plitzi/sdk-shared/authoring/builder';

/**
 * The one way a rendered space can ask the application AROUND it to do something.
 *
 * Every other source acts on things the space owns — its own state, its own router, its own session. A space
 * embedded in an application does not own the window: opening one of the host's screens, signing out of the host's
 * keyring, quitting. Without this, anything shaped like an application shell had to be written in the host's own
 * code, which is the one part of a product that then cannot be authored, themed or changed without a release.
 *
 * ONE declared action rather than one per verb, because what a host offers is the host's business and no catalog
 * here can know it. `action` names the handler the host registered; a name it did not register does nothing, which
 * is the same answer a space gets for every other callback that resolves to nothing.
 */
export const hostCallbacks: Record<string, BuiltinGlobalCallback> = {
  hostAction: {
    source: 'host',
    title: 'Host Action',
    strictParams: true,
    params: {
      action: {
        type: 'text',
        description: 'The name the host registered the handler under — `openSpace`, `signOut`, whatever it offers.',
        default: ''
      },
      value: {
        type: 'scalar',
        description: 'What the action is about: the space to open, the workspace to switch to. Optional.',
        default: ''
      }
    }
  }
};

export default hostCallbacks;
