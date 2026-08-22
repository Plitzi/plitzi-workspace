import type { ActionDocument } from './ActionTypes';
import type { Environment } from './CommonTypes';
import type { ConnectorManifestDraft } from './ConnectorTypes';

export type SpaceCredentialProvider = 's3' | 'r2' | 'ssr' | 'custom';

/**
 * A connector manifest as the builder sees it.
 *
 * The manifest is server-side state — it names endpoints and an auth scheme — so this shape exists for the editor
 * and for the API that maintains it, never for a published page. What reaches a visitor is the connector's
 * identifier and nothing else.
 */
export type SpaceConnector = {
  id: number;
  identifier: string;
  name: string;
  manifest: ConnectorManifestDraft;
  createdAt: number;
  updatedAt: number;
};

/**
 * A server action as the builder sees it.
 *
 * The document is server-side state — it names credentials, connectors and steps — so this shape exists for the
 * editor and the API that maintains it, never for a published page. What reaches a visitor is the action's
 * identifier and its input/output fields, derived server-side.
 */
export type SpaceAction = {
  id: number;
  identifier: string;
  name: string;
  document: ActionDocument;
  createdAt: number;
  updatedAt: number;
};

export type SpaceCredential = {
  identifier: string;
  name: string;
  provider: SpaceCredentialProvider;
  inUse: boolean;
  usedIn: {
    usedFrom: string;
    name: string;
  }[];
  createdAt: number;
  updatedAt: number;
};

export type SpaceDeployment = {
  id: number;
  environment: Environment;
  revision: number | null;
  domain: string;
  isVerified: boolean;
  default: boolean;
  credential: SpaceCredential | null;
  createdAt: number;
  updatedAt: number;
};
