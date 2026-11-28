import { createContext } from 'react';

import { createCredential } from '../helpers/credential';

import type { Credential } from '../helpers/credential';

/**
 * The person's credential as the builder holds it now — one object for the builder's life, renewed in place. What opens
 * a connection reads it as it opens: a socket outlives the token it was opened with, and a `userKey` captured in a
 * render reopened it with that old one after every renewal.
 */
const BuilderCredentialContext = createContext<Credential>(createCredential(''));
BuilderCredentialContext.displayName = 'BuilderCredentialContext';

export default BuilderCredentialContext;
