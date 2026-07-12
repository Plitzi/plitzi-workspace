import { InMemoryCache } from '@apollo/client/cache';
import { ApolloClient, HttpLink } from '@apollo/client/core';
import { SetContextLink } from '@apollo/client/link/context';

import { createStripTypenameLink } from '@plitzi/sdk-shared/helpers/stripTypename';

import type { Server } from '@plitzi/sdk-shared';

export const initClient = (finalServer: Server, webKey: string) => {
  const httpLink = new HttpLink({ uri: finalServer.serverUrl });
  const cache = new InMemoryCache();

  // Init Auth Link
  const authLink = new SetContextLink(prevContext => ({
    headers: {
      ...(prevContext.headers as Record<string, string>),
      'sdk-version': VERSION,
      authorization: webKey ? `Bearer ${webKey}` : ''
    }
  }));

  // Init Client
  return new ApolloClient({ link: authLink.concat(createStripTypenameLink(), httpLink), cache });
};
