import { renderTaskParams } from './helpers';

import type { ActionTask } from '../types';

type QueryParams = {
  credential: string;
  sql: string;
  params: string;
};

const TEMPLATE = /\{\{/;

const parseParams = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    throw new Error('Query parameters are not a valid JSON array');
  }
};

/**
 * Queries a database the SPACE owns, through a credential it declared.
 *
 * Two rules make this defensible, and both are enforced here rather than trusted to whoever authors the flow:
 *
 * 1. **The statement is a literal.** A `{{ … }}` anywhere in `sql` is refused outright — not escaped, not
 *    sanitized, refused. Interpolating a value into a statement is SQL injection with a visual editor on top, and
 *    the only safe version of that feature is its absence.
 * 2. **The connection is the customer's.** The DSN comes from a credential the document declared, and this
 *    deployment's own database is not reachable through any credential a space can hold.
 *
 * `params` are bound by the driver, in order, for `?`/`$1` placeholders — the driver decides which, because that
 * is the one thing that genuinely differs between engines.
 */
const query: ActionTask<QueryParams> = {
  namespace: 'db',
  action: 'query',
  title: 'Database Query',
  description: 'Runs a parameterized statement against a database this space declared as a credential',
  // The params carry `{{ … }}` in the VALUES, which only this task may resolve — and `sql`, which it must not.
  rawParams: true,
  params: {
    credential: { type: 'text', canBind: true, defaultValue: '', label: 'Connection (credential)' },
    sql: { type: 'codemirror-text', canBind: false, defaultValue: '', label: 'SQL (no templates)' },
    params: { type: 'codemirror-json', canBind: true, defaultValue: '[]', label: 'Bound parameters' }
  },
  run: async (raw, ctx) => {
    if (!raw.credential) {
      throw new Error('The query names no connection credential');
    }

    if (raw.sql.trim() === '') {
      throw new Error('The query is empty');
    }

    if (TEMPLATE.test(raw.sql)) {
      throw new Error('The statement must be a literal: put the value in `params` and use a placeholder');
    }

    const credential = await ctx.credential(raw.credential);
    if (!credential) {
      throw new Error(`Credential "${raw.credential}" is not available for this space`);
    }

    const { engine, dsn } = credential;
    if (!engine || !dsn) {
      throw new Error(`Credential "${raw.credential}" carries no engine and dsn`);
    }

    const driver = ctx.dbDrivers.find(item => item.engine === engine);
    if (!driver) {
      throw new Error(`This server has no driver for "${engine}"`);
    }

    // Only the PARAMS are rendered — never the statement, which was refused above if it carried a token at all.
    const rendered = await renderTaskParams({ params: raw.params }, ctx, raw.credential);
    const rows = await driver.query(dsn, raw.sql, parseParams(rendered.params), ctx.signal);

    return { rows, count: rows.length };
  }
};

export const dbTasks = [query] as ActionTask<Record<string, unknown>>[];
