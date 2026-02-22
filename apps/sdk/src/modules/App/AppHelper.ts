import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';

import { createStripTypenameLink } from '../../helpers/stripTypename';

import type { Server } from '@plitzi/sdk-shared';

export const initClient = (finalServer: Server, webKey: string) => {
  const httpLink = new HttpLink({ uri: finalServer.graphqlServer });
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
