import type { Context } from 'react';

export type SourceField = { path: string; name: string };

export type SourceMeta = {
  id: string;
  name: string;
  source: string;
  fields?: SourceField[] | (() => SourceField[] | Promise<SourceField[]>);
};

export type Source<T = unknown> = { id: string; meta: SourceMeta; context: Context<T> };
